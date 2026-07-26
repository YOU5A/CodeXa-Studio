using System.Text.Json;
using FluentAssertions;
using NcmStudio.Core.Metadata;

namespace NcmStudio.Tests;

public class NcmMetadataParserTests
{
    private static byte[] BuildMetaJson(string title = "Test Song", string artist = "Test Artist",
        string album = "Test Album", string format = "flac", int bitrate = 960000, int duration = 240000)
    {
        // NCM uses a 2D array for artist: [["name", id], ...]
        var obj = new Dictionary<string, object>
        {
            ["musicId"] = 123456789L,
            ["musicName"] = title,
            ["artist"] = new[] { new[] { (object)artist, 0L } },
            ["album"] = album,
            ["albumPic"] = "http://example.com/cover.jpg",
            ["format"] = format,
            ["bitrate"] = bitrate,
            ["duration"] = duration,
        };
        var json = JsonSerializer.Serialize(obj);
        return System.Text.Encoding.UTF8.GetBytes(json);
    }

    [Fact]
    public void Parse_ValidJson_ReturnsCorrectMetadata()
    {
        var jsonBytes = BuildMetaJson("My Song", "My Artist", "My Album", "flac", 960000, 240000);
        var result = NcmMetadataParser.Parse(jsonBytes);

        result.Title.Should().Be("My Song");
        result.Artist.Should().Be("My Artist");
        result.Album.Should().Be("My Album");
        result.Format.Should().Be("flac");
        result.Bitrate.Should().Be(960000);
        result.Duration.Should().Be(240000);
        result.MusicId.Should().Be(123456789);
    }

    [Fact]
    public void Parse_MissingFields_ShouldNotThrow()
    {
        var obj = new Dictionary<string, object> { ["musicId"] = 1L };
        var json = JsonSerializer.Serialize(obj);
        var jsonBytes = System.Text.Encoding.UTF8.GetBytes(json);

        var result = NcmMetadataParser.Parse(jsonBytes);
        result.Title.Should().Be("");
        result.Artist.Should().Be("");
    }

    [Fact]
    public void Parse_WithCoverData_SetsHasCover()
    {
        var jsonBytes = BuildMetaJson();
        var coverData = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 };

        var result = NcmMetadataParser.Parse(jsonBytes, coverData);

        result.HasCover.Should().BeTrue();
        result.CoverData.Should().NotBeNull();
        result.CoverData.Should().HaveCount(4);
    }

    [Fact]
    public void Parse_EmptyCoverData_SetsHasCoverFalse()
    {
        var jsonBytes = BuildMetaJson();
        var result = NcmMetadataParser.Parse(jsonBytes, []);

        result.HasCover.Should().BeFalse();
    }

    [Fact]
    public void Parse_MultipleArtists_JoinsWithComma()
    {
        var obj = new Dictionary<string, object>
        {
            ["musicId"] = 1L,
            ["artist"] = new[] { new[] { (object)"Artist A", 0L }, new[] { (object)"Artist B", 1L } },
        };
        var json = JsonSerializer.Serialize(obj);
        var jsonBytes = System.Text.Encoding.UTF8.GetBytes(json);

        var result = NcmMetadataParser.Parse(jsonBytes);
        result.Artist.Should().Be("Artist A, Artist B");
    }
}
