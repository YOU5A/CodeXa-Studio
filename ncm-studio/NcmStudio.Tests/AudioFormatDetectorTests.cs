using FluentAssertions;
using NcmStudio.Core.Audio;
using NcmStudio.Core.Models;

namespace NcmStudio.Tests;

public class AudioFormatDetectorTests
{
    [Fact]
    public void Detect_FlacMagic_ReturnsFlac()
    {
        var header = new byte[] { 0x66, 0x4C, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22 };
        var result = AudioFormatDetector.Detect(header);
        result.Should().Be(AudioFormat.Flac);
    }

    [Fact]
    public void Detect_Id3Magic_ReturnsMp3()
    {
        var header = new byte[] { 0x49, 0x44, 0x33, 0x03, 0x00, 0x00 };
        var result = AudioFormatDetector.Detect(header);
        result.Should().Be(AudioFormat.Mp3);
    }

    [Fact]
    public void Detect_MpegFrameSync_ReturnsMp3()
    {
        var header = new byte[] { 0xFF, 0xFB, 0x90, 0x00 };
        var result = AudioFormatDetector.Detect(header);
        result.Should().Be(AudioFormat.Mp3);
    }

    [Fact]
    public void Detect_MpegFrameSyncAlt_ReturnsMp3()
    {
        var header = new byte[] { 0xFF, 0xFA, 0x90, 0x00 };
        var result = AudioFormatDetector.Detect(header);
        result.Should().Be(AudioFormat.Mp3);
    }

    [Fact]
    public void Detect_RandomData_ReturnsUnknown()
    {
        var header = new byte[] { 0x00, 0x01, 0x02, 0x03, 0x04, 0x05 };
        var result = AudioFormatDetector.Detect(header);
        result.Should().Be(AudioFormat.Unknown);
    }

    [Fact]
    public void Detect_TooShort_ReturnsUnknown()
    {
        var header = new byte[] { 0x66, 0x4C }; // Partial FLAC magic
        var result = AudioFormatDetector.Detect(header);
        result.Should().Be(AudioFormat.Unknown);
    }

    [Fact]
    public void Detect_Empty_ReturnsUnknown()
    {
        var result = AudioFormatDetector.Detect([]);
        result.Should().Be(AudioFormat.Unknown);
    }
}
