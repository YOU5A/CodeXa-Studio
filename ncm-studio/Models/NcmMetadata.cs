namespace NcmStudio.Core.Models;

public class NcmMetadata
{
    public long MusicId { get; set; }
    public string Title { get; set; } = "";
    public string Artist { get; set; } = "";
    public string Album { get; set; } = "";
    public string AlbumPicUrl { get; set; } = "";
    public string Format { get; set; } = "";
    public int Bitrate { get; set; }
    public int Duration { get; set; }
    public bool HasCover { get; set; }
    public byte[]? CoverData { get; set; }
}
