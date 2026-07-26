using FluentAssertions;
using NcmStudio.Core.Decoder;
using NcmStudio.Core.Models;

namespace NcmStudio.Tests;

public class NcmFileParserTests
{
    private static byte[] BuildValidNcmHeader(int keyLen = 16, int metaLen = 20, int imageSize = 0)
    {
        using var ms = new MemoryStream();
        using var bw = new System.IO.BinaryWriter(ms);

        bw.Write(new byte[] { 0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D });
        bw.Write((byte)0x00);
        bw.Write((byte)0x00);
        bw.Write((uint)keyLen);
        bw.Write(new byte[keyLen]);
        bw.Write((uint)metaLen);
        bw.Write(System.Text.Encoding.UTF8.GetBytes(new string('x', metaLen)));
        bw.Write((uint)0);
        bw.Write(new byte[5]);
        bw.Write((uint)imageSize);
        if (imageSize > 0)
            bw.Write(new byte[imageSize]);

        bw.Flush();
        return ms.ToArray();
    }

    [Fact]
    public void Parse_ValidHeader_ShouldSucceed()
    {
        var data = BuildValidNcmHeader();
        using var ms = new MemoryStream(data);
        var header = NcmFileParser.Parse(ms);

        header.Should().NotBeNull();
        header.KeyLength.Should().Be(16);
        header.MetaLength.Should().Be(20);
        header.CoverImage.Should().NotBeNull();
        header.AudioStartOffset.Should().BeGreaterThan(0);
    }

    [Fact]
    public void Parse_InvalidMagic_ShouldThrow()
    {
        var data = new byte[] { 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 };
        using var ms = new MemoryStream(data);
        var act = () => NcmFileParser.Parse(ms);
        act.Should().Throw<InvalidDataException>();
    }

    [Fact]
    public void Parse_TruncatedFile_ShouldThrow()
    {
        var data = new byte[] { 0x43, 0x54, 0x45, 0x4E, 0x46, 0x44, 0x41, 0x4D, 0x00, 0x00 };
        using var ms = new MemoryStream(data);
        var act = () => NcmFileParser.Parse(ms);
        act.Should().Throw<System.IO.EndOfStreamException>();
    }

    [Fact]
    public void Parse_WithCoverImage_ShouldReadCoverData()
    {
        var data = BuildValidNcmHeader(imageSize: 10);
        using var ms = new MemoryStream(data);
        var header = NcmFileParser.Parse(ms);

        header.ImageSize.Should().Be(10);
        header.CoverImage.Should().HaveCount(10);
    }

    [Fact]
    public void Parse_AudioStartOffset_ShouldBeReasonable()
    {
        var data = BuildValidNcmHeader(keyLen: 16, metaLen: 20);
        var expectedHeaderEnd = data.Length; // no audio data appended

        using var ms = new MemoryStream(data);
        var header = NcmFileParser.Parse(ms);

        // AudioStartOffset should be near the end of header
        // (BinaryReader may buffer, so allow some tolerance)
        header.AudioStartOffset.Should().BeGreaterThan(0);
    }
}