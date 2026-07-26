using TagLib;
using NcmStudio.Core.Models;

namespace NcmStudio.Core.Metadata;

public static class TagWriter
{
    public static void Write(string audioPath, NcmMetadata meta)
    {
        using var file = TagLib.File.Create(audioPath);
        var tag = file.Tag;
        if (!string.IsNullOrEmpty(meta.Title)) tag.Title = meta.Title;
        if (!string.IsNullOrEmpty(meta.Artist)) tag.Performers = new[] { meta.Artist };
        if (!string.IsNullOrEmpty(meta.Album)) tag.Album = meta.Album;
        if (meta.CoverData is { Length: > 0 })
        {
            tag.Pictures = new TagLib.IPicture[]
            {
                new TagLib.Picture
                {
                    Type = TagLib.PictureType.FrontCover,
                    MimeType = CoverArtExtractor.DetectMimeType(meta.CoverData),
                    Data = new TagLib.ByteVector(meta.CoverData)
                }
            };
        }
        file.Save();
    }
}