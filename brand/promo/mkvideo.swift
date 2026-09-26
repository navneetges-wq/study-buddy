// Encode an image sequence to H.264 MP4 using AVFoundation.
// No ffmpeg on this machine; macOS can do this natively.
import Foundation
import AVFoundation
import CoreGraphics
import ImageIO

func loadCG(_ url: URL) -> CGImage? {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(src, 0, nil)
}

let a = CommandLine.arguments
guard a.count >= 6, let fps = Int32(a[3]), let W = Int(a[4]), let H = Int(a[5]) else {
    FileHandle.standardError.write("usage: mkvideo <framesDir> <out.mp4> <fps> <w> <h>\n".data(using: .utf8)!)
    exit(2)
}
let dir = URL(fileURLWithPath: a[1]), out = URL(fileURLWithPath: a[2])
try? FileManager.default.removeItem(at: out)

let files = (try FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil))
    .filter { ["jpg","jpeg","png"].contains($0.pathExtension.lowercased()) }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard !files.isEmpty else { FileHandle.standardError.write("no frames in \(dir.path)\n".data(using: .utf8)!); exit(1) }

let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 14_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
    ] as [String: Any],
])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
        kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
    ])
writer.add(input)
guard writer.startWriting() else {
    FileHandle.standardError.write("startWriting failed: \(String(describing: writer.error))\n".data(using: .utf8)!); exit(1)
}
writer.startSession(atSourceTime: .zero)

var n = 0
for f in files {
    guard let img = loadCG(f) else { continue }
    while !input.isReadyForMoreMediaData { usleep(1500) }
    var pbOut: CVPixelBuffer?
    guard let pool = adaptor.pixelBufferPool,
          CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pbOut) == kCVReturnSuccess,
          let buf = pbOut else { continue }
    CVPixelBufferLockBaseAddress(buf, [])
    if let ctx = CGContext(data: CVPixelBufferGetBaseAddress(buf), width: W, height: H,
            bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buf),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) {
        ctx.draw(img, in: CGRect(x: 0, y: 0, width: W, height: H))
    }
    CVPixelBufferUnlockBaseAddress(buf, [])
    adaptor.append(buf, withPresentationTime: CMTime(value: CMTimeValue(n), timescale: fps))
    n += 1
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
if writer.status == .completed {
    print("wrote \(out.lastPathComponent) — \(n) frames @ \(fps)fps")
} else {
    FileHandle.standardError.write("failed: \(String(describing: writer.error))\n".data(using: .utf8)!); exit(1)
}
