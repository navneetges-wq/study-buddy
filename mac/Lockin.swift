// Lockin.swift — the Lockin Mac app: one window running the Lockin web app from inside the bundle,
// plus the native pieces a browser tab can't have (see bridge.js for the web side):
//   · "looked away" means Lockin stopped being the app in front
//   · hands-free speech on macOS speech recognition, spoken answers in the macOS voice
//   · real notifications, the Mac clipboard, a timer in the menu bar
// Build with ./build.sh (no Xcode needed).
import AppKit
import AVFoundation
import Speech
import UserNotifications
import WebKit

let PUBLIC_URL = "https://navneetges-wq.github.io/study-buddy/"
let SELFTEST = ProcessInfo.processInfo.environment["LOCKIN_SELFTEST"]

// MARK: - serving the bundled web app as lockin://app/…

final class SchemeHandler: NSObject, WKURLSchemeHandler {
    let root: URL
    init(root: URL) { self.root = root.standardizedFileURL }
    static let types = ["html": "text/html", "css": "text/css", "js": "text/javascript", "json": "application/json", "webmanifest": "application/manifest+json",
                        "png": "image/png", "jpg": "image/jpeg", "svg": "image/svg+xml", "mp4": "video/mp4", "woff2": "font/woff2"]
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.path), let data = try? Data(contentsOf: file) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
            task.didFinish(); return
        }
        let mime = SchemeHandler.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                        headerFields: ["Content-Type": mime, "Content-Length": "\(data.count)", "Cache-Control": "no-cache"])!)
        task.didReceive(data)
        task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

// MARK: - speech recognition (macOS), shaped like the web's SpeechRecognition

final class Listener {
    weak var web: WKWebView?
    let engine = AVAudioEngine()
    var recognizer: SFSpeechRecognizer?
    var request: SFSpeechAudioBufferRecognitionRequest?
    var task: SFSpeechRecognitionTask?
    var id = 0, gen = 0, running = false, continuous = true, interim = true
    var last: SFSpeechRecognitionResult?
    var silence: Timer?
    var onDenied: (() -> Void)?

    func emit(_ id: Int, _ type: String, _ data: Any = NSNull()) {
        guard let json = try? JSONSerialization.data(withJSONObject: ["id": id, "type": type, "data": data]),
              let s = String(data: json, encoding: .utf8) else { return }
        web?.evaluateJavaScript("window.__lockinSpeech && window.__lockinSpeech(\(s))")
    }

    func start(id: Int, lang: String, continuous: Bool, interim: Bool) {
        if running { stop() }
        self.id = id; self.continuous = continuous; self.interim = interim
        authorize { [weak self] ok in
            guard let self, self.id == id else { return }
            guard ok else { self.emit(id, "error", "not-allowed"); self.emit(id, "end"); self.onDenied?(); return }
            let r = SFSpeechRecognizer(locale: Locale(identifier: lang)) ?? SFSpeechRecognizer()
            guard let r, r.isAvailable else { self.emit(id, "error", "network"); self.emit(id, "end"); return }
            self.recognizer = r
            do {
                let input = self.engine.inputNode
                input.removeTap(onBus: 0)
                input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { [weak self] buf, _ in self?.request?.append(buf) }
                self.engine.prepare()
                try self.engine.start()
            } catch { self.emit(id, "error", "audio-capture"); self.emit(id, "end"); return }
            self.running = true
            self.emit(id, "start")
            self.beginUtterance()
        }
    }

    func authorize(_ done: @escaping (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                guard status == .authorized else { return done(false) }
                switch AVCaptureDevice.authorizationStatus(for: .audio) {
                case .authorized: done(true)
                case .notDetermined: AVCaptureDevice.requestAccess(for: .audio) { ok in DispatchQueue.main.async { done(ok) } }
                default: done(false)
                }
            }
        }
    }

    // one utterance at a time: the phrase is final after a short silence, then the next one starts
    func beginUtterance() {
        guard running, let r = recognizer else { return }
        gen += 1; let g = gen
        task?.cancel(); request?.endAudio()
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        if r.supportsOnDeviceRecognition { req.requiresOnDeviceRecognition = true }   // private: nothing leaves the Mac
        request = req; last = nil
        task = r.recognitionTask(with: req) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, g == self.gen else { return }
                if let result {
                    self.last = result
                    if result.isFinal { self.finish(g) }
                    else {
                        if self.interim { self.emit(self.id, "result", ["final": false, "alts": [result.bestTranscription.formattedString]]) }
                        self.silence?.invalidate()
                        self.silence = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: false) { [weak self] _ in self?.finish(g) }
                    }
                } else if error != nil {
                    if self.last != nil { self.finish(g) }
                    else if self.continuous && self.running { self.beginUtterance() }
                    else { self.emit(self.id, "error", "no-speech"); self.stop() }
                }
            }
        }
    }

    func finish(_ g: Int) {
        guard g == gen, let result = last else { return }
        silence?.invalidate()
        let alts = result.transcriptions.prefix(5).map { $0.formattedString }
        emit(id, "result", ["final": true, "alts": alts.isEmpty ? [result.bestTranscription.formattedString] : alts])
        last = nil
        if continuous && running { beginUtterance() } else { stop() }
    }

    func stop() {
        guard running else { return }
        running = false; gen += 1
        silence?.invalidate()
        task?.cancel(); request?.endAudio(); task = nil; request = nil
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        emit(id, "end")
    }
}

// MARK: - speaking

final class Voice: NSObject, AVSpeechSynthesizerDelegate {
    weak var web: WKWebView?
    let synth = AVSpeechSynthesizer()
    var ids: [ObjectIdentifier: Int] = [:]
    override init() { super.init(); synth.delegate = self }
    func say(_ text: String, id: Int, rate: Double) {
        let u = AVSpeechUtterance(string: text)
        u.rate = Float(min(1, max(0.3, Double(AVSpeechUtteranceDefaultSpeechRate) * rate)))
        ids[ObjectIdentifier(u)] = id
        synth.speak(u)
    }
    func hush() { synth.stopSpeaking(at: .immediate) }
    func done(_ u: AVSpeechUtterance) {
        guard let id = ids.removeValue(forKey: ObjectIdentifier(u)) else { return }
        DispatchQueue.main.async { self.web?.evaluateJavaScript("window.__lockinTTS && window.__lockinTTS({id:\(id),type:'end'})") }
    }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) { done(u) }
    func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) { done(u) }
}

// MARK: - the app

final class App: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate, UNUserNotificationCenterDelegate {
    var window: NSWindow!
    var web: WKWebView!
    let listener = Listener()
    let voice = Voice()
    var status: NSStatusItem!
    var statusMenu = NSMenu()
    var running = false, paused = false
    var activity: NSObjectProtocol?

    func applicationDidFinishLaunching(_ n: Notification) {
        buildMenu()
        let root = Bundle.main.resourceURL!.appendingPathComponent("web")
        let cfg = WKWebViewConfiguration()
        cfg.setURLSchemeHandler(SchemeHandler(root: root), forURLScheme: "lockin")
        cfg.websiteDataStore = .default()
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = true
        let ucc = cfg.userContentController
        ucc.add(self, name: "lockin")
        if let src = try? String(contentsOf: Bundle.main.url(forResource: "bridge", withExtension: "js")!, encoding: .utf8) {
            ucc.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        web = WKWebView(frame: .zero, configuration: cfg)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.setValue(false, forKey: "drawsBackground")
        if #available(macOS 13.3, *) { web.isInspectable = true }
        listener.web = web; voice.web = web
        listener.onDenied = { [weak self] in self?.explainMicBlocked() }

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1080, height: 820), styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Lockin"
        window.titlebarAppearsTransparent = true
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(red: 0.043, green: 0.051, blue: 0.067, alpha: 1)
        window.minSize = NSSize(width: 420, height: 560)
        window.isReleasedWhenClosed = false
        window.delegate = self
        window.contentView = web
        window.center()
        window.setFrameAutosaveName("LockinMain")
        window.makeKeyAndOrderFront(nil)

        web.load(URLRequest(url: URL(string: "lockin://app/index.html")!))

        status = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        status.button?.image = App.logoImage()
        status.button?.imagePosition = .imageLeading
        status.menu = statusMenu
        statusMenu.delegate = self
        refreshStatusMenu()

        UNUserNotificationCenter.current().delegate = self
        // timers keep firing on time even when the window is behind other apps
        activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiatedAllowingIdleSystemSleep], reason: "Lockin focus timer")

        let nc = NotificationCenter.default
        nc.addObserver(forName: NSApplication.didResignActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.setHidden(true) }
        nc.addObserver(forName: NSApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.setHidden(!(self.window.isVisible && !self.window.isMiniaturized))
        }
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { false }   // the menu bar timer keeps going
    func applicationShouldHandleReopen(_ s: NSApplication, hasVisibleWindows: Bool) -> Bool { showWindow(); return true }
    func windowWillClose(_ n: Notification) { setHidden(true) }
    func windowDidMiniaturize(_ n: Notification) { setHidden(true) }
    func windowDidDeminiaturize(_ n: Notification) { setHidden(!NSApp.isActive) }

    @objc func showWindow() {
        if window.isMiniaturized { window.deminiaturize(nil) }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        setHidden(false)
    }
    func setHidden(_ h: Bool) { web?.evaluateJavaScript("window.__lockinSetHidden && window.__lockinSetHidden(\(h))") }

    // messages from bridge.js
    func userContentController(_ ucc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], let cmd = m["cmd"] as? String else { return }
        switch cmd {
        case "listen":
            listener.start(id: m["id"] as? Int ?? 0, lang: m["lang"] as? String ?? "en-US",
                           continuous: m["continuous"] as? Bool ?? false, interim: m["interim"] as? Bool ?? false)
        case "unlisten": if (m["id"] as? Int) == listener.id { listener.stop() }
        case "say": voice.say(m["text"] as? String ?? "", id: m["id"] as? Int ?? 0, rate: m["rate"] as? Double ?? 1)
        case "hush": voice.hush()
        case "copy":
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(m["text"] as? String ?? "", forType: .string)
        case "notifyPermission":
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { ok, _ in
                DispatchQueue.main.async { self.web.evaluateJavaScript("window.__lockinPerm && window.__lockinPerm('\(ok ? "granted" : "denied")')") }
            }
        case "notify":
            let c = UNMutableNotificationContent()
            c.title = m["title"] as? String ?? "Lockin"; c.body = m["body"] as? String ?? ""; c.sound = .default
            UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "lockin-\(UUID().uuidString)", content: c, trigger: nil))
        case "status":
            let time = m["time"] as? String ?? "", state = m["state"] as? String ?? ""
            let wasRunning = running
            running = m["running"] as? Bool ?? false; paused = m["paused"] as? Bool ?? false
            let busy = running || state.lowercased().contains("break")
            status.button?.title = busy ? " " + time : ""
            status.button?.font = NSFont.monospacedDigitSystemFont(ofSize: 13, weight: .medium)
            if wasRunning != running { refreshStatusMenu() }
        default: break
        }
    }

    func syncNotificationPermission() {
        UNUserNotificationCenter.current().getNotificationSettings { s in
            let p: String = s.authorizationStatus == .authorized || s.authorizationStatus == .provisional ? "granted" : s.authorizationStatus == .denied ? "denied" : "default"
            DispatchQueue.main.async { self.web.evaluateJavaScript("window.__lockinSetPerm && window.__lockinSetPerm('\(p)')") }
        }
    }
    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification, withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) { done([.banner, .sound]) }
    func userNotificationCenter(_ c: UNUserNotificationCenter, didReceive r: UNNotificationResponse, withCompletionHandler done: @escaping () -> Void) { showWindow(); done() }

    // links: the app stays in the window; everything else opens in the browser
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = a.request.url else { return decisionHandler(.cancel) }
        if url.scheme == "lockin" {
            let file = url.lastPathComponent
            if file == "landing.html" || file == "about.html" { NSWorkspace.shared.open(URL(string: PUBLIC_URL + file)!); return decisionHandler(.cancel) }
            return decisionHandler(.allow)
        }
        if a.navigationType == .other, url.scheme == "about" { return decisionHandler(.allow) }
        NSWorkspace.shared.open(url)
        decisionHandler(.cancel)
    }
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
        if let url = a.request.url { NSWorkspace.shared.open(url.scheme == "lockin" ? URL(string: PUBLIC_URL + url.lastPathComponent)! : url) }
        return nil
    }
    func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
        syncNotificationPermission()
        setHidden(!(NSApp.isActive && window.isVisible))
        if let t = SELFTEST { selfTest(t) }
    }
    func webViewWebContentProcessDidTerminate(_ w: WKWebView) { w.reload() }

    // alert / confirm / prompt, as Mac sheets
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage msg: String, initiatedByFrame f: WKFrameInfo, completionHandler done: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = msg; a.addButton(withTitle: "OK")
        a.beginSheetModal(for: window) { _ in done() }
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage msg: String, initiatedByFrame f: WKFrameInfo, completionHandler done: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = msg; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        a.beginSheetModal(for: window) { r in done(r == .alertFirstButtonReturn) }
    }
    func webView(_ w: WKWebView, runJavaScriptTextInputPanelWithPrompt msg: String, defaultText: String?, initiatedByFrame f: WKFrameInfo, completionHandler done: @escaping (String?) -> Void) {
        let a = NSAlert(); a.messageText = msg; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 320, height: 24)); field.stringValue = defaultText ?? ""
        a.accessoryView = field
        a.beginSheetModal(for: window) { r in done(r == .alertFirstButtonReturn ? field.stringValue : nil) }
        a.window.initialFirstResponder = field
    }

    func explainMicBlocked() {
        let a = NSAlert()
        a.messageText = "Lockin can't hear you yet"
        a.informativeText = "Hands-free needs the microphone and speech recognition. Turn both on for Lockin in System Settings › Privacy & Security, then try again."
        a.addButton(withTitle: "Open System Settings"); a.addButton(withTitle: "Not now")
        a.beginSheetModal(for: window) { r in
            if r == .alertFirstButtonReturn { NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")!) }
        }
    }

    // MARK: menus

    func buildMenu() {
        let main = NSMenu()
        func item(_ t: String, _ a: Selector?, _ k: String = "", _ mods: NSEvent.ModifierFlags = [.command], target: AnyObject? = nil) -> NSMenuItem {
            let i = NSMenuItem(title: t, action: a, keyEquivalent: k); i.keyEquivalentModifierMask = mods; i.target = target; return i
        }
        let appMenu = NSMenu()
        appMenu.addItem(item("About Lockin", #selector(NSApplication.orderFrontStandardAboutPanel(_:))))
        appMenu.addItem(item("Lockin on the web", #selector(openSite), target: self))
        appMenu.addItem(.separator())
        appMenu.addItem(item("Hide Lockin", #selector(NSApplication.hide(_:)), "h"))
        appMenu.addItem(item("Hide Others", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]))
        appMenu.addItem(.separator())
        appMenu.addItem(item("Quit Lockin", #selector(NSApplication.terminate(_:)), "q"))
        let edit = NSMenu(title: "Edit")
        edit.addItem(item("Undo", Selector(("undo:")), "z")); edit.addItem(item("Redo", Selector(("redo:")), "z", [.command, .shift]))
        edit.addItem(.separator())
        edit.addItem(item("Cut", #selector(NSText.cut(_:)), "x")); edit.addItem(item("Copy", #selector(NSText.copy(_:)), "c"))
        edit.addItem(item("Paste", #selector(NSText.paste(_:)), "v")); edit.addItem(item("Select All", #selector(NSText.selectAll(_:)), "a"))
        let view = NSMenu(title: "View")
        view.addItem(item("Reload", #selector(reload), "r", target: self))
        view.addItem(item("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]))
        let win = NSMenu(title: "Window")
        win.addItem(item("Show Lockin", #selector(showWindow), "0", target: self))
        win.addItem(item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"))
        win.addItem(item("Close", #selector(NSWindow.performClose(_:)), "w"))
        for (title, menu) in [("Lockin", appMenu), ("Edit", edit), ("View", view), ("Window", win)] {
            let top = NSMenuItem(title: title, action: nil, keyEquivalent: ""); top.submenu = menu; main.addItem(top)
        }
        NSApp.mainMenu = main
        NSApp.windowsMenu = win
    }

    func refreshStatusMenu() {
        statusMenu.removeAllItems()
        func add(_ t: String, _ cmd: String) { let i = NSMenuItem(title: t, action: #selector(runCommand(_:)), keyEquivalent: ""); i.target = self; i.representedObject = cmd; statusMenu.addItem(i) }
        if running {
            add(paused ? "Resume" : "Pause", paused ? "resume" : "pause")
            add("Add 5 minutes", "add 5 minutes")
            add("Finish session", "finish")
        } else {
            add("Start 25 minutes", "start 25 minutes")
            add("Start 45 minutes", "start 45 minutes")
            add("Start 60 minutes", "start 60 minutes")
        }
        statusMenu.addItem(.separator())
        let show = NSMenuItem(title: "Show Lockin", action: #selector(showWindow), keyEquivalent: ""); show.target = self; statusMenu.addItem(show)
        let quit = NSMenuItem(title: "Quit Lockin", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"); statusMenu.addItem(quit)
    }
    @objc func runCommand(_ sender: NSMenuItem) {
        guard let cmd = sender.representedObject as? String else { return }
        let js = try! JSONSerialization.data(withJSONObject: [cmd]); let arg = String(data: js, encoding: .utf8)!.dropFirst().dropLast()
        web.evaluateJavaScript("window.__lockinCommand(\(arg))")
        if cmd.hasPrefix("start") { showWindow() }
    }
    @objc func reload() { web.reload() }
    @objc func openSite() { NSWorkspace.shared.open(URL(string: PUBLIC_URL + "landing.html")!) }

    // the logo (open ring + dot) as a menu-bar template image
    static func logoImage() -> NSImage {
        let img = NSImage(size: NSSize(width: 18, height: 18), flipped: true) { _ in
            let ring = NSBezierPath()
            ring.appendArc(withCenter: NSPoint(x: 9, y: 10), radius: 6, startAngle: -47, endAngle: 227, clockwise: false)
            ring.lineWidth = 3; ring.lineCapStyle = .round
            NSColor.black.setStroke(); ring.stroke()
            NSColor.black.setFill(); NSBezierPath(ovalIn: NSRect(x: 7, y: 2, width: 4, height: 4)).fill()
            return true
        }
        img.isTemplate = true
        return img
    }

    // MARK: self-test (LOCKIN_SELFTEST=write|read): prints what works inside the app, then quits

    func selfTest(_ mode: String) {
        let js = """
        (() => { const r = {};
          r.secure = window.isSecureContext; r.speech = typeof webkitSpeechRecognition; r.tts = typeof speechSynthesis.speak;
          r.notification = typeof Notification; r.rtc = typeof RTCPeerConnection; r.bc = typeof BroadcastChannel; r.clipboard = typeof navigator.clipboard.writeText;
          r.hidden = document.hidden; r.voiceSupported = VoiceControl.supported; r.focusMode = document.body.className;
          r.fontsReady = document.fonts.status;
          if ('\(mode)' === 'write') localStorage.setItem('lockin.__selftest', String(Date.now()));
          else { r.persisted = localStorage.getItem('lockin.__selftest'); localStorage.removeItem('lockin.__selftest'); }
          r.sessions = (JSON.parse(localStorage.getItem('lockin.v1') || '{}').sessions || []).length;
          return JSON.stringify(r); })()
        """
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            self.web.evaluateJavaScript(js) { res, err in
                print("SELFTEST", res ?? "nil", err.map { "\($0)" } ?? "")
                print("SELFTEST speech-auth", SFSpeechRecognizer.authorizationStatus().rawValue, "on-device", SFSpeechRecognizer()?.supportsOnDeviceRecognition ?? false)
                self.web.takeSnapshot(with: nil) { image, _ in
                    if let image, let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff), let png = rep.representation(using: .png, properties: [:]) {
                        try? png.write(to: URL(fileURLWithPath: ProcessInfo.processInfo.environment["LOCKIN_SNAPSHOT"] ?? "/tmp/lockin-snapshot.png"))
                    }
                    fflush(stdout); NSApp.terminate(nil)
                }
            }
        }
    }
}

extension App: NSMenuDelegate {
    func menuNeedsUpdate(_ menu: NSMenu) { refreshStatusMenu() }
}

let app = NSApplication.shared
let delegate = App()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
