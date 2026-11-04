// encode.swift — JPEG frames + an audio file → one MP4 (H.264 video, AAC audio), using macOS's own AVFoundation.
// Usage: swift encode.swift <framesDir> <fps> <audio.m4a> <out.mp4>
import AVFoundation
import AppKit

let a = CommandLine.arguments
let dir = a[1], fps = Int32(a[2])!, audioPath = a[3], outPath = a[4]
let files = try! FileManager.default.contentsOfDirectory(atPath: dir).filter { $0.hasSuffix(".jpg") }.sorted()
let first = NSImage(contentsOfFile: "\(dir)/\(files[0])")!
let rep0 = NSBitmapImageRep(data: first.tiffRepresentation!)!
let W = rep0.pixelsWide, H = rep0.pixelsHigh

// 1) frames → silent video
let tmp = URL(fileURLWithPath: outPath + ".video.mp4")
try? FileManager.default.removeItem(at: tmp)
let writer = try! AVAssetWriter(outputURL: tmp, fileType: .mp4)
let settings: [String: Any] = [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: (W * H > 2_000_000 ? 16_000_000 : 12_000_000), AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H])
writer.add(input); writer.startWriting(); writer.startSession(atSourceTime: .zero)
for (i, f) in files.enumerated() {
  autoreleasepool {
    guard let img = NSImage(contentsOfFile: "\(dir)/\(f)"), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return }
    var pb: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
    CVPixelBufferLockBaseAddress(pb!, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb!),
                        space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: W, height: H))
    CVPixelBufferUnlockBaseAddress(pb!, [])
    while !input.isReadyForMoreMediaData { usleep(2000) }
    adaptor.append(pb!, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
  }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }; done.wait()

// 2) silent video + audio → final MP4
let comp = AVMutableComposition()
let vAsset = AVURLAsset(url: tmp), aAsset = AVURLAsset(url: URL(fileURLWithPath: audioPath))
let vTrack = vAsset.tracks(withMediaType: .video)[0]
let range = CMTimeRange(start: .zero, duration: vAsset.duration)
let cv = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
try! cv.insertTimeRange(range, of: vTrack, at: .zero)
if let aTrack = aAsset.tracks(withMediaType: .audio).first {
  let ca = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
  try! ca.insertTimeRange(CMTimeRange(start: .zero, duration: min(vAsset.duration, aAsset.duration)), of: aTrack, at: .zero)
}
let out = URL(fileURLWithPath: outPath); try? FileManager.default.removeItem(at: out)
let ex = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetPassthrough)!
ex.outputURL = out; ex.outputFileType = .mp4
let d2 = DispatchSemaphore(value: 0)
ex.exportAsynchronously { d2.signal() }; d2.wait()
print(ex.status == .completed ? "wrote \(outPath) \(W)x\(H) \(files.count) frames" : "export failed: \(String(describing: ex.error))")
try? FileManager.default.removeItem(at: tmp)
