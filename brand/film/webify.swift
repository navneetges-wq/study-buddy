// webify.swift — make a light web copy of a video (H.264 at a set bitrate + AAC) and a poster image.
// Usage: swift webify.swift <in.mp4> <out.mp4> <videoKbps> <poster.jpg> <posterSeconds>
import AVFoundation
import AppKit
let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1])), out = URL(fileURLWithPath: a[2]), kbps = Int(a[3])!
let vt = asset.tracks(withMediaType: .video)[0], at = asset.tracks(withMediaType: .audio)[0]
let size = vt.naturalSize
let reader = try! AVAssetReader(asset: asset)
let vOut = AVAssetReaderTrackOutput(track: vt, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange])
let aOut = AVAssetReaderTrackOutput(track: at, outputSettings: [AVFormatIDKey: kAudioFormatLinearPCM])
reader.add(vOut); reader.add(aOut)
try? FileManager.default.removeItem(at: out)
let writer = try! AVAssetWriter(outputURL: out, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true          // moov atom first, so playback starts before the whole file loads
let vIn = AVAssetWriterInput(mediaType: .video, outputSettings: [AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: Int(size.width), AVVideoHeightKey: Int(size.height),
  AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: kbps * 1000, AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel, AVVideoMaxKeyFrameIntervalKey: 60]])
let aIn = AVAssetWriterInput(mediaType: .audio, outputSettings: [AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: 48000, AVNumberOfChannelsKey: 2, AVEncoderBitRateKey: 160000])
writer.add(vIn); writer.add(aIn)
reader.startReading(); writer.startWriting(); writer.startSession(atSourceTime: .zero)
let g = DispatchGroup()
for (inp, outp, q) in [(vIn, vOut as AVAssetReaderOutput, "v"), (aIn, aOut as AVAssetReaderOutput, "a")] {
  g.enter()
  inp.requestMediaDataWhenReady(on: DispatchQueue(label: q)) {
    while inp.isReadyForMoreMediaData {
      if let s = outp.copyNextSampleBuffer() { inp.append(s) } else { inp.markAsFinished(); g.leave(); return }
    }
  }
}
g.wait()
let sem = DispatchSemaphore(value: 0); writer.finishWriting { sem.signal() }; sem.wait()
// poster
let gen = AVAssetImageGenerator(asset: asset); gen.appliesPreferredTrackTransform = true
gen.requestedTimeToleranceBefore = .zero; gen.requestedTimeToleranceAfter = .zero
let cg = try! gen.copyCGImage(at: CMTime(seconds: Double(a[5])!, preferredTimescale: 600), actualTime: nil)
let rep = NSBitmapImageRep(cgImage: cg)
try! rep.representation(using: .jpeg, properties: [.compressionFactor: 0.78])!.write(to: URL(fileURLWithPath: a[4]))
print("wrote", a[2], a[4])
