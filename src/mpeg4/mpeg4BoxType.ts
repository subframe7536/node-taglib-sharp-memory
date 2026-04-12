import {ByteVector, StringType} from "../byteVector";

/**
 * Provides references to different box types used by the library. This class is used to severely
 * reduce the number of times these types are created in {@link AppleTag,} greatly improving the
 * speed at which warm files are read.
 *
 * These box types were cross-referenced with FFMPEG source and Exiftool database.
 */
const Mpeg4BoxType: Record<string, ByteVector> = {
    /** QuickTime album artist box */
    AART: getType("aART"),
    /** QuickTime album box */
    ALB: getType("©alb"),
    /** QuickTime artist box */
    ART: getType("©ART"),
    /** QuickTime comment box */
    CMT: getType("©cmt"),
    /**
     * QuickTime conductor box. This is listed in the FFMPEG source and Exiftool.
     */
    CON: getType("©con"),
    /**
     * Conductor box from original .NET source. This is not listed anywhere in the Exiftool or
     * FFMPEG docs.
     * @TODO: Remove this when backwards compat time has ended.
     */
    COND: getType("cond"),
    /** QuickTime cover art box */
    COVR: getType("covr"),
    /** ISO 64-bit chunk offset box */
    CO64: getType("co64"),
    /** QuickTime compilation flag box */
    CPIL: getType("cpil"),
    /** QuickTime copyright box */
    CPRT: getType("cprt"),
    /** iTunesInfo tag data box */
    DATA: getType("data"),
    /** QuickTime content create date */
    DAY: getType("©day"),
    /** QuickTime description box @TODO: What about DSCP used in 3gp videos? */
    DESC: getType("desc"),
    /** QuickTime disk number box */
    DISK: getType("disk"),
    /** Date tagged box? @TODO: There's no record of this one */
    DTAG: getType("dtag"),
    /** ISO Elementary stream descriptor box */
    ESDS: getType("esds"),
    /** ISO Free space box */
    FREE: getType("free"),
    /** ISO File type box */
    FTYP: getType("ftyp"),
    /** QuickTime genre box */
    GEN: getType("©gen"),
    /** 3GPP genre box? */
    GNRE: getType("gnre"),
    /** QuickTime gouping box */
    GRP: getType("©grp"),
    /** ISO handler box */
    HDLR: getType("hdlr"),
    /** Quicktime item list box */
    ILST: getType("ilst"),
    /** iTunesInfo tag box */
    ITUNES_TAG_BOX: getType("----"),
    /** QuickTIme lyrics box */
    LYR: getType("©lyr"),
    /** ISO media data container box */
    MDAT: getType("mdat"),
    /** ISO media information container box */
    MDIA: getType("mdia"),
    /** ISO metadata container box */
    META: getType("meta"),
    /** iTunesInfo tag meaning box */
    MEAN: getType("mean"),
    /** ISO media information container box */
    MINF: getType("minf"),
    /** ISO box containing all metadata */
    MOOV: getType("moov"),
    /** ISO movie header and overall declarations box */
    MVHD: getType("mvhd"),
    /** QuickTime title box */
    NAM: getType("©nam"),
    /** iTunesInfo tag name box */
    NAME: getType("name"),
    /** Performers role box? @TODO: There's no record of this one */
    ROLE: getType("role"),
    /** ISO free space box */
    SKIP: getType("skip"),
    /** QuickTime sortable album artist box */
    SOAA: getType("soaa"),
    /** QuickTime sortable album title box */
    SOAL: getType("soal"),
    /** QuickTime sortable artist box */
    SOAR: getType("soar"),
    /** QuickTime sortable composer box */
    SOCO: getType("soco"),
    /** QuickTime sortable title box */
    SONM: getType("sonm"),
    /** ISO sample table box */
    STBL: getType("stbl"),
    /** ISO chunk offset box */
    STCO: getType("stco"),
    /** ISO sample description box */
    STSD: getType("stsd"),
    /**
     * QuickTime subtitle box. This is listed in the FFMPEG source and Exiftool.
     */
    ST3: getType("©st3"),
    /**
     * Subtitle box from original .NET source. This is not listed anywhere in the Exiftool or
     * FFMPEG docs.
     * @TODO: Remove this when backwards compat time has ended.
     */
    SUBT: getType("Subt"),
    /** Alias text box? @TODO: There's no record of this one */
    TEXT: getType("text"),
    /** QuickTime BPM box */
    TMPO: getType("tmpo"),
    /** ISO track container box */
    TRAK: getType("trak"),
    /** QuickTime track number box @TODO: What about ©TRK as per FFMPEG source? */
    TRKN: getType("trkn"),
    /** ISO User data box */
    UDTA: getType("udta"),
    /**
     * Alias URL box?
     * @remarks Specified in FFMPEG source but not in Exiftool.
     */
    URL: getType("©url"),
    /** ISO user extension box */
    UUID: getType("uuid"),
    /** QuickTime composer box */
    WRT: getType("©wrt"),
}
function getType(id: string): ByteVector {
    return ByteVector.fromString(id, StringType.Latin1).makeReadOnly();
}
export default Mpeg4BoxType;
