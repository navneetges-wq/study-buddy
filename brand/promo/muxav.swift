// Mux an existing H.264 MP4 with an AAC track, without re-encoding either.
import Foundation
import AVFoundation

let a = CommandLine.arguments
guard a.count >= 4 else {
    FileHandle.standardError.write("usage: muxav <video.mp4> <audio.m4a> <out.mp4>\n".data(using: .utf8)!); exit(2)
}
let vURL = URL(fileURLWithPath: a[1]), aURL = URL(fileURLWithPath: a[2]), oURL = URL(fileURLWithPath: a[3])
try? FileManager.default.removeItem(at: oURL)

let sem = DispatchSemaphore(value: 0)
var failure: String? = nil

Task {
    defer { sem.signal() }
    do {
        let v = AVURLAsset(url: vURL), s = AVURLAsset(url: aURL)
        guard let vt = try await v.loadTracks(withMediaType: .video).first else { failure = "no video track"; return }
        guard let at = try await s.loadTracks(withMediaType: .audio).first else { failure = "no audio track"; return }
        let vDur = try await v.load(.duration), aDur = try await s.load(.duration)

        let comp = AVMutableComposition()
        guard let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
              let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)
        else { failure = "could not add tracks"; return }

        try cv.insertTimeRange(CMTimeRange(start: .zero, duration: vDur), of: vt, at: .zero)
        try ca.insertTimeRange(CMTimeRange(start: .zero, duration: min(aDur, vDur)), of: at, at: .zero)

        guard let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough) else {
            failure = "no export session"; return
        }
        try await ex.export(to: oURL, as: .mp4)
        print(String(format: "muxed — video %.2fs + audio %.2fs",
                     CMTimeGetSeconds(vDur), CMTimeGetSeconds(aDur)))
    } catch { failure = "\(error)" }
}
sem.wait()
if let f = failure { FileHandle.standardError.write("failed: \(f)\n".data(using: .utf8)!); exit(1) }
