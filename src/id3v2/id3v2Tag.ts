import * as DateFormat from "dateformat";
import AttachmentFrame from "./frames/attachmentFrame";
import CommentsFrame from "./frames/commentsFrame";
import ExtendedHeader from "./extendedHeader";
import FrameFactory from "./frames/frameFactory";
import FrameTypes from "./frameTypes";
import Genres from "../genres";
import Header from "./header";
import SyncData from "./syncData";
import UniqueFileIdentifierFrame from "./frames/uniqueFileIdentifierFrame";
import UnsynchronizedLyricsFrame from "./frames/unsynchronizedLyricsFrame";
import {ByteVector, StringType} from "../byteVector";
import {File, FileAccessMode, ReadStyle} from "../file";
import {Frame, FrameClassType} from "./frames/frame";
import {Id3v2FrameFlags, Id3v2FrameHeader} from "./frames/frameHeader";
import {HeaderFlags} from "./headerFlags";
import {IPicture} from "../picture";
import {Tag, TagTypes} from "../tag";
import {TextInformationFrame, UserTextInformationFrame} from "./frames/textInformationFrame";
import {UrlLinkFrame} from "./frames/urlLinkFrame";
import {Guards} from "../utils";

export default class Id3v2Tag extends Tag {
    private static _defaultEncoding: StringType = StringType.UTF8;
    private static _defaultVersion: number = 3;
    private static _forceDefaultEncoding: boolean = false;
    private static _forceDefaultVersion: boolean = false;
    private static _language: string = undefined;       // @TODO: Use the os-locale module to supply a
                                                        // lazily loaded "default" locale
    private static _useNumericGenres: boolean = true;   // @TODO: DO WE HAVE TO???

    private _extendedHeader: ExtendedHeader;
    private _frameList: Frame[] = [];
    private _header: Header;
    private _performersRole: string[];

    // #region Constructors



    // #endregion

    // #region Properties

    /**
     * Gets the encoding to use when creating new frames.
     */
    public static get defaultEncoding(): StringType { return this._defaultEncoding; }
    /**
     * Sets the encoding to use when creating new frames.
     * @param value Encoding to use when creating new frames
     */
    public static set defaultEncoding(value: StringType) { this._defaultEncoding = value; }

    /**
     * Gets the default version to use when creating new tags.
     * If {@see forceDefaultEncoding} is `true` then all tags will be rendered with this version.
     */
    public static get defaultVersion(): number { return Id3v2Tag._defaultVersion; }
    /**
     * Sets the default version to use when creating new tags.
     * If {@see forceDefaultEncoding} is `true` then all tags will be rendered with this version.
     * @param value ID3v2 version to use. Must be 2, 3, or 4. The default for this library is 3
     */
    public static set defaultVersion(value: number) {
        Guards.byte(value, "value");
        Guards.between(value, 2, 4, "value");
        Id3v2Tag._defaultVersion = value;
    }

    /**
     * Gets whether or not to render all frames with the default encoding rather than their
     * original encoding.
     */
    public static get forceDefaultEncoding(): boolean { return Id3v2Tag._forceDefaultEncoding; }
    /**
     * Sets whether or not to render all frames with the default encoding rather than their
     * original encoding.
     * @param value If `true` frames will be rendered using {@see defaultEncoding} rather than
     *     their original encoding.
     */
    public static set forceDefaultEncoding(value: boolean) { Id3v2Tag._forceDefaultEncoding = value; }

    /**
     * Gets whether or not to save all tags in the default version rather than their original
     * version.
     */
    public static get forceDefaultVersion(): boolean { return this._forceDefaultVersion; }
    /**
     * Sets whether or not to save all tags in the default version rather than their original
     * version.
     * @param value If `true`, tags will be saved in the version defined in {@see defaultVersion}
     *     rather than their original format, with the exception of tags with footers which will
     *     always be saved in version 4
     */
    public static set forceDefaultVersion(value: boolean) { this._forceDefaultVersion = value; }

    /**
     * Gets the ISO-639-2 language code to use when searching for and storing language specific
     * values.
     */
    public static get language(): string { return Id3v2Tag._language; }
    /**
     * Gets the ISO-639-2 language code to use when searching for and storing language specific
     * values.
     * @param value ISO-639-2 language code to use. If the language is unknown `"   "` is the
     *     appropriate filler
     */
    public static set language(value: string) {
        Id3v2Tag._language = !value || value.length < 3
            ? "   "
            : value.substr(0, 3);
    }

    /**
     * Gets whether or not to use ID3v1 style numeric genres when possible.
     * If `true`, the library will try looking up the numeric genre code when storing the value.
     * for ID3v2.2 and ID3v2.3 "Rock" would be stored as "(17)" and for ID3v2.4, it would be
     * stored as "17".
     */
    public static get useNumericGenres(): boolean { return this._useNumericGenres; }
    /**
     * Sets whether or not to use ID3v1 style numeric genres when possible.
     * If `true`, the library will try looking up the numeric genre code when storing the value.
     * for ID3v2.2 and ID3v2.3 "Rock" would be stored as "(17)" and for ID3v2.4, it would be
     * stored as "17".
     * @param value Whether or not to use genres with numeric values when values when possible
     */
    public static set useNumericGenres(value: boolean) { this._useNumericGenres = value; }

    /**
     * Gets the header flags applied to the current instance.
     */
    public get flags(): HeaderFlags { return this._header.flags; }
    /**
     * Sets the header flags applied to the current instance
     * @param value Bitwise combined {@see HeaderFlags} value contiaining flags applied to the
     *     current instance.
     */
    public set flags(value: HeaderFlags) { this._header.flags = value; }

    /**
     * Gets all frames contained in the current instance.
     */
    public get frames(): Frame[] { return this._frameList; }

    /**
     * Gets whether or not the album described by the current instance is a compilation.
     * This property is implemented using the TCMP Text Information Frame to provide support for a
     * feature of the Apple iPod and iTunes products.
     */
    public get isCompilation(): boolean {
        const val = this.getTextAsString(FrameTypes.TCMP);
        return val && val !== "0";
    }
    /**
     * Gets whether or not the album described by the current instance is a compilation.
     * This property is implemented using the TCMP Text Information Frame to provide support for a
     * feature of the Apple iPod and iTunes products.
     * @param value Whether or not the album described by the current instance is a compilation
     */
    public set isCompilation(value: boolean) {
        this.setTextFrame(FrameTypes.TCMP, value ? "1" : undefined);
    }

    /**
     * Gets the ID3v2 version for the current instance.
     */
    public get version(): number {
        return Id3v2Tag.forceDefaultVersion
            ? Id3v2Tag.defaultVersion
            : this._header.majorVersion;
    }
    /**
     * Sets the ID3v2 version for the current instance.
     * @param value ID3v2 version for the current instance. Must be 2, 3, or 4.
     */
    public set version(value: number) {
        Guards.byte(value, "value");
        Guards.between(value, 2, 4, "value");
        this._header.majorVersion = value;
    }

    // #region Tag Implementations

    /** @inheritDoc */
    public get tagTypes(): TagTypes { return TagTypes.Id3v2; }

    /**
     * @inheritDoc
     * From TIT2 frame
     */
    public get title(): string { return this.getTextAsString(FrameTypes.TIT2); }
    /**
     * @inheritDoc
     * Stored in TIT2 frame
     */
    public set title(value: string) { this.setTextFrame(FrameTypes.TIT2, value); }

    /** @inheritDoc via TSOT frame */
    get titleSort(): string { return this.getTextAsString(FrameTypes.TSOT); }
    /** @inheritDoc via TSOT frame */
    set titleSort(value: string) { this.setTextFrame(FrameTypes.TSOT, value); }

    /** @inheritDoc via TIT3 frame */
    get subtitle(): string { return this.getTextAsString(FrameTypes.TIT3); }
    /** @inheritDoc via TIT3 frame */
    set subtitle(value: string) { this.setTextFrame(FrameTypes.TIT3, value); }

    /** @inheritDoc via user text frame "description" */
    get description(): string { return this.getUserTextAsString("Description"); }
    /** @inheritDoc via user text frame "description" */
    set description(value: string) { this.setUserTextAsString("Description", value); }

    /** @inheritDoc via TPE1 frame */
    get performers(): string[] { return this.getTextAsArray(FrameTypes.TPE1); }
    /** @inheritDoc via TPE1 frame */
    set performers(value: string[]) { this.setTextFrame(FrameTypes.TPE1, ...value); }

    /** @inheritDoc via TSOP frame */
    get performersSort(): string[] { return this.getTextAsArray(FrameTypes.TSOP); }
    /** @inheritDoc via TSOP frame */
    set performersSort(value: string[]) { this.setTextFrame(FrameTypes.TSOP, ...value); }

    /** @inheritDoc via TMCL frame */
    get performersRole(): string[] {
        if (this._performersRole) { return this._performersRole; }

        const perfRef = this.performers;
        if (!perfRef) { return []; }

        // Map the instruments to the performers
        const map = this.getTextAsArray(FrameTypes.TMCL);
        this._performersRole = [];
        for (let i = 0; i + 1 < map.length; i += 2) {
            const inst = map[i];
            const perfs = map[i + 1];
            if (!inst || !perfs) { continue; }

            const perfList = perfs.split(",");
            for (const iperf of perfList) {
                if (!iperf) { continue; }

                const perf = iperf.trim();
                if (!perf) { continue; }

                for (let j = 0; j < perfRef.length; j++) {
                    if (perfRef[j] === perf) {
                        this._performersRole[j] = this._performersRole[j]
                            ? this._performersRole[j] + "; " + inst
                            : inst;
                    }
                }
            }
        }

        return this._performersRole;
    }
    /** @inheritDoc via TMCL frame */
    set performersRole(value: string[]) { this._performersRole = value || []; }

    /** @inheritDoc via TSO2 frame */
    get albumArtists(): string[] { return this.getTextAsArray(FrameTypes.TSO2); }
    /** @inheritDoc via TSO2 frame */
    set albumArtists(value: string[]) { this.setTextFrame(FrameTypes.TSO2, ...value); }

    /** @inheritDoc via TPE2 frame */
    get albumArtistsSort(): string[] { return this.getTextAsArray(FrameTypes.TPE2); }
    /** @inheritDoc via TPE2 frame */
    set albumArtistsSort(value: string[]) { this.setTextFrame(FrameTypes.TPE2, ...value); }

    /** @inheritDoc via TCOM frame */
    get composers(): string[] { return this.getTextAsArray(FrameTypes.TCOM); }
    /** @inheritDoc via TCOM frame */
    set composers(value: string[]) { this.setTextFrame(FrameTypes.TCOM, ...value); }

    /** @inheritDoc via TSOC frame */
    get composersSort(): string[] { return this.getTextAsArray(FrameTypes.TSOC); }
    /** @inheritDoc via TSOC frame */
    set composersSort(value: string[]) { this.setTextFrame(FrameTypes.TSOC, ...value); }

    /** @inheritDoc via TALB frame */
    get album(): string { return this.getTextAsString(FrameTypes.TALB); }
    /** @inheritDoc via TALB frame */
    set album(value: string) { this.setTextFrame(FrameTypes.TALB, value); }

    /** @inheritDoc via TSOA frame */
    get albumSort(): string { return this.getTextAsString(FrameTypes.TSOA); }
    /** @inheritDoc via TSOA fram */
    set albumSort(value: string) { this.setTextFrame(FrameTypes.TSOA, value); }

    /** @inheritDoc via COMM frame */
    get comment(): string {
        const f = CommentsFrame.getPreferred(this, "", Id3v2Tag.language);
        return f ? f.toString() : undefined;
    }
    /** @inheritDoc via COMM frame */
    set comment(value: string) {
        let frame: CommentsFrame;
        if (!value) {
            frame = CommentsFrame.getPreferred(this, "", Id3v2Tag.language);
            while (frame) {
                this.removeFrame(frame);
                frame = CommentsFrame.getPreferred(this, "", Id3v2Tag.language);
            }
            return;
        }
    }

    /** @inheritDoc via TCON frame */
    get genres(): string[] {
        const text = this.getTextAsArray(FrameTypes.TCON);
        if (text.length === 0) { return text; }

        const list = [];
        for (const genre of text) {
            if (!genre) { continue; }

            // The string may just be a genre number
            const genreFromIndex = Genres.indexToAudio(genre);
            if (genreFromIndex) {
                list.push(genreFromIndex);
            } else {
                list.push(genre);
            }
        }

        return list;
    }
    /** @inheritDoc via TCON frame */
    set genres(value: string[]) {
        if (!value || !Id3v2Tag.useNumericGenres) {
            this.setTextFrame(FrameTypes.TCON, ...value);
            return;
        }

        // Clone the array so changes made won't affect the passed array
        value = value.slice();
        for (let i = 0; i < value.length; i++) {
            const index = Genres.audioToIndex(value[i]);
            if (index !== 255) {
                value[i] = index.toString();
            }
        }

        this.setTextFrame(FrameTypes.TCON, ...value);
    }

    /** @inheritDoc via TDRC frame */
    get year(): number {
        const text = this.getTextAsString(FrameTypes.TDRC);
        if (!text || text.length < 4) { return 0; }

        const year = Number.parseInt(text.substr(0, 4), 10);
        // @TODO: Check places where we use this pattern... .parseInt doesn't parse the whole string if it started with
        //     good data
        if (Number.isNaN(year) || year < 0) {
            return 0;
        }

        return year;
    }
    /**
     * @inheritDoc via TDRC frame
     * NOTE: values >9999will remove the frame
     */
    set year(value: number) {
        Guards.uint(value, "value");
        if (value > 9999) {
            value = 0;
        }
        this.setNumberFrame(FrameTypes.TDRC, value, 0);
    }

    /** @inheritDoc via TRCK frame */
    get track(): number { return this.getTextAsUint32(FrameTypes.TRCK, 0); }
    /** @inheritDoc via TRCK frame */
    set track(value: number) { this.setNumberFrame(FrameTypes.TRCK, value, this.trackCount, 2); }

    /** @inheritDoc via TRCK frame */
    get trackCount(): number { return this.getTextAsUint32(FrameTypes.TRCK, 1); }
    /** @inheritDoc via TRCK frame */
    set trackCount(value: number) { this.setNumberFrame(FrameTypes.TRCK, this.track, value); }

    /** @inheritDoc via TPOS frame */
    get disc(): number { return this.getTextAsUint32(FrameTypes.TPOS, 0); }
    /** @inheritDoc via TPOS frame */
    set disc(value: number) { this.setNumberFrame(FrameTypes.TPOS, value, this.discCount); }

    /** @inheritDoc via TPOS frame */
    get discCount(): number { return this.getTextAsUint32(FrameTypes.TPOS, 1); }
    /** @inheritDoc via TPOS frame */
    set discCount(value: number) { this.setNumberFrame(FrameTypes.TPOS, this.disc, value); }

    /** @inheritDoc via USLT frame */
    get lyrics(): string {
        const frame = UnsynchronizedLyricsFrame.getPreferred(this, "", Id3v2Tag.language);
        return frame ? frame.toString() : undefined;
    }
    /** @inheritDoc via USLT frame */
    set lyrics(value: string) {
        let frame: UnsynchronizedLyricsFrame;
        if (!value) {
            frame = UnsynchronizedLyricsFrame.getPreferred(this, "", Id3v2Tag.language);
            while (frame) {
                this.removeFrame(frame);
                frame = UnsynchronizedLyricsFrame.getPreferred(this, "", Id3v2Tag.language);
            }

            return;
        }

        frame = UnsynchronizedLyricsFrame.get(this, "", Id3v2Tag.language, true);
        frame.text = value;
        frame.textEncoding = Id3v2Tag.defaultEncoding;
    }

    /** @inheritDoc via TIT1 frame */
    get grouping(): string { return this.getTextAsString(FrameTypes.TIT1); }
    /** @inheritDoc via TIT1 frame */
    set grouping(value: string) { this.setTextFrame(FrameTypes.TIT1, value); }

    /** @inheritDoc via TBPM frame */
    get beatsPerMinute(): number {
        const text = this.getTextAsString(FrameTypes.TBPM);
        if (!text) { return 0; }
        const num = Number.parseFloat(text);
        return Number.isNaN(num) || num < 0.0 ? 0 : Math.round(num);
    }
    /** @inheritDoc via TBPM frame */
    set beatsPerMinute(value: number) { this.setNumberFrame(FrameTypes.TBPM, value, 0); }

    /** @inheritDoc via TPE3 frame */
    get conductor(): string { return this.getTextAsString(FrameTypes.TPE3); }
    /** @inheritDoc via TPE3 frame */
    set conductor(value: string) { this.setTextFrame(FrameTypes.TPE3, value); }

    /** @inheritDoc via TCOP frame */
    get copyright(): string { return this.getTextAsString(FrameTypes.TCOP); }
    /** @inheritDoc via TCOP frame */
    set copyright(value: string) { this.setTextFrame(FrameTypes.TCOP, value); }

    /** @inheritDoc via TDTG frame */
    get dateTagged(): Date | undefined {
        const strValue = this.getTextAsString(FrameTypes.TDTG);
        if (!strValue) { return undefined; }
        const dateValue = new Date(strValue);
        return isNaN(dateValue.getTime()) ? undefined : dateValue;
    }
    /** @inheritDoc via TDTG frame */
    set dateTagged(value: Date | undefined) {
        let strValue: string;
        if (value) {
            strValue = DateFormat(value, "yyyy-mm-dd HH:MM:ss");
            strValue = strValue.replace(" ", "T");
        }
        this.setTextFrame(FrameTypes.TDTG, strValue);
    }

    /** @inheritDoc via TXXX:MusicBrainz Artist Id frame */
    get musicBrainzArtistId(): string { return this.getUserTextAsString("MusicBrainz Artist Id"); }
    /** @inheritDoc via TXXX:MusicBrainz Artist Id frame */
    set musicBrainzArtistId(value: string) { this.setUserTextAsString("MusicBrainz Artist Id", value); }

    /** @inheritDoc via TXXX:MusicBrainz Relase Group Id frame */
    get musicBrainzReleaseGroupId(): string { return this.getUserTextAsString("MusicBrainz Release Group Id"); }
    /** @inheritDoc via TXXX:MusicBrainz Relase Group Id frame */
    set musicBrainzReleaseGroupId(value: string) { this.setUserTextAsString("MusicBrainz Release Group Id", value); }

    /** @inheritDoc via TXXX:MusicBrainz Album Id frame */
    get musicBrainzReleaseId(): string { return this.getUserTextAsString("MusicBrainz Album Id"); }
    /** @inheritDoc via TXXX:MusicBrainz Album Id frame */
    set musicBrainzReleaseId(value: string) { this.setUserTextAsString("MusicBrainz Album Id", value); }

    /** @inheritDoc via TXXX:MusicBrainz Album Artist Id frame */
    get musicBrainzReleaseArtistId(): string { return this.getUserTextAsString("MusicBrainz Album Artist Id"); }
    /** @inheritDoc via TXXX:MusicBrainz Album Artist Id frame */
    set musicBrainzReleaseArtistId(value: string) { this.setUserTextAsString("MusicBrainz Album Artist Id", value); }

    /** @inheritDoc via UFID:http://musicbrainz.org frame */
    get musicBrainzTrackId(): string { return this.getUfidText("http://musicbrainz.org"); }
    /** @inheritDoc via UFID:http://musicbrainz.org frame */
    set musicBrainzTrackId(value: string) { this.setUfidText("http://musicBrainz.org", value); }

    /** @inheritDoc via TXXX:MusicBrainz Disc Id frame */
    get musicBrainzDiscId(): string { return this.getUserTextAsString("MusicBrainz Disc Id"); }
    /** @inheritDoc via TXXX:MusicBrainz Disc Id frame */
    set musicBrainzDiscId(value: string) { this.setUserTextAsString("MusicBrainz Disc Id", value); }

    /** @inheritDoc via TXXX:MusicIP PUID frame */
    get musicIpId(): string { return this.getUserTextAsString("MusicIP PUID"); }
    /** @inheritDoc via TXXX:MusicIP PUID frame */
    set musicIpId(value: string) { this.setUserTextAsString("MusicIP PUID", value); }

    /** @inheritDoc via TXXX:ASIN */
    get amazonId(): string { return this.getUserTextAsString("ASIN"); }
    /** @inheritDoc via TXXX:ASIN */
    set amazonId(value: string) { this.setUserTextAsString("ASIN", value); }

    /** @inheritDoc via TXXX:MusicBrainz Album Status frame */
    get musicBrainzReleaseStatus(): string { return this.getUserTextAsString("MusicBrainz Album Status"); }
    /** @inheritDoc via TXXX:MusicBrainz Album Status frame */
    set musicBrainzReleaseStatus(value: string) { this.setUserTextAsString("MusicBrainz Album Status", value); }

    /** @inheritDoc via TXXX:MusicBrainz Album Type frame */
    get musicBrainzReleaseType(): string { return this.getUserTextAsString("MusicBrainz Album Type"); }
    /** @inheritDoc via TXXX:MusicBrainz Album Type frame */
    set musicBrainzReleaseType(value: string) { this.setUserTextAsString("MusicBrainz Album Album Type", value); }

    /** @inheritDoc via TXXX:MusicBrainz Album Release Country frame */
    get musicBrainzReleaseCountry(): string { return this.getUserTextAsString("MusicBrainz Album Release Country"); }
    /** @inheritDoc via TXXX:MusicBrainz Album Release Country frame */
    set musicBrainzReleaseCountry(value: string) {
        this.setUserTextAsString("MusicBrainz Album Release Country", value);
    }

    /** @inheritDoc via TXXX:REPLAY_GAIN_TRACK_GAIN frame */
    get replayGainTrackGain(): number {
        let text = this.getUserTextAsString("REPLAYGAIN_TRACK_GAIN", false);
        if (!text) { return NaN; }
        if (text.toLowerCase().endsWith("db")) {
            text = text.substr(0, text.length - 2).trim();
        }

        return Number.parseFloat(text);
    }
    /** @inheritDoc via TXXX:REPLAY_GAIN_TRACK_GAIN frame */
    set replayGainTrackGain(value: number) {
        if (Number.isNaN(value)) {
            this.setUserTextAsString("REPLAYGAIN_TRACK_GAIN", undefined, false);
        } else {
            const text = `${value.toFixed(2).toString()} dB`;
            this.setUserTextAsString("REPLAYGAIN_TRACK_GAIN", text, false);
        }
    }

    /** @inheritDoc via TXXX:REPLAYGAIN_TRACK_PEAK frame */
    get replayGainTrackPeak(): number {
        const text: string = this.getUserTextAsString("REPLAYGAIN_TRACK_PEAK", false);
        return text ? Number.parseFloat(text) : NaN;
    }
    /** @inheritDoc via TXXX:REPLAYGAIN_TRACK_PEAK frame */
    set replayGainTrackPeak(value: number) {
        if (Number.isNaN(value)) {
            this.setUserTextAsString("REPLAYGAIN_TRACK_PEAK", undefined, false);
        } else {
            const text = value.toFixed(6).toString();
            this.setUserTextAsString("REPLAYGAIN_TRACK_PEAK", text, false);
        }
    }

    /** @inheritDoc via TXXX:REPLAYGAIN_ALBUM_GAIN frame */
    get replayGainAlbumGain(): number {
        let text = this.getUserTextAsString("REPLAYGAIN_ALBUM_GAIN", false);
        if (!text) { return NaN; }
        if (text.toLowerCase().endsWith("db")) {
            text = text.substr(0, text.length - 2).trim();
        }

        return Number.parseFloat(text);
    }
    /** @inheritDoc via TXXX:REPLAYGAIN_ALBUM_GAIN frame */
    set replayGainAlbumGain(value: number) {
        if (Number.isNaN(value)) {
            this.setUserTextAsString("REPLAYGAIN_ALBUM_GAIN", undefined, false);
        } else {
            const text = `${value.toFixed(2).toString()} dB`;
            this.setUserTextAsString("REPLAYGAIN_ALBUM_GAIN", text, false);
        }
    }

    /** @inheritDoc via TXXX:REPLAYGAIN_ALBUM_PEAK frame */
    get replayGainAlbumPeak(): number {
        const text: string = this.getUserTextAsString("REPLAYGAIN_ALBUM_PEAK", false);
        return text ? Number.parseFloat(text) : NaN;
    }
    /** @inheritDoc via TXXX:REPLAYGAIN_ALBUM_PEAK frame */
    set replayGainAlbumPeak(value: number) {
        if (Number.isNaN(value)) {
            this.setUserTextAsString("REPLAYGAIN_TRACK_PEAK", undefined, false);
        } else {
            const text = value.toFixed(6).toString();
            this.setUserTextAsString("REPLAYGAIN_TRACK_PEAK", text, false);
        }
    }

    /** @inheritDoc via TKEY frame */
    get initialKey(): string { return this.getTextAsString(FrameTypes.TKEY); }
    /** @inheritDoc via TKEY frame */
    set initialKey(value: string) { this.setTextFrame(FrameTypes.TKEY, value); }

    /** @inheritDoc via TPE4 frame */
    get remixedBy(): string { return this.getTextAsString(FrameTypes.TPE4); }
    /** @inheritDoc via TPE4 frame */
    set remixedBy(value: string) { this.setTextFrame(FrameTypes.TPE4, value); }

    /** @inheritDoc via TPUB frame */
    get publisher(): string { return this.getTextAsString(FrameTypes.TPUB); }
    /** @inheritDoc via TPUB frame */
    set publisher(value: string) { this.setTextFrame(FrameTypes.TPUB, value); }

    /** @inheritDoc via TSRC frame */
    get isrc(): string { return this.getTextAsString(FrameTypes.TSRC); }
    /** @inheritDoc via TSRC frame */
    set isrc(value: string) { this.setTextFrame(FrameTypes.TSRC, value); }

    /** @inheritDoc via APIC frame */
    get pictures(): IPicture[] {
        return this.getFramesByClassType<AttachmentFrame>(FrameClassType.AttachmentFrame).slice(0);
    }
    /** @inheritDoc via APIC frame */
    set pictures(value: IPicture[]) {
        this.removeFrames(FrameTypes.APIC);
        this.removeFrames(FrameTypes.GEOB);

        if (!value || value.length === 0) { return; }

        for (const pic of value) {
            this.addFrame(AttachmentFrame.fromPicture(pic));
        }
    }

    /** @inheritDoc */
    public get isEmpty(): boolean { return this._frameList.length === 0; }


    // #endregion

    // #endregion

    // #region Public Methods

    /**
     * Adds a frame to the current instance.
     * @param frame Frame to add to the current instance
     */
    public addFrame(frame: Frame): void {
        Guards.truthy(frame, "frame");
        this._frameList.push(frame);
    }

    /** @inheritDoc */
    public clear(): void {
        this._frameList.splice(0, this._frameList.length);
    }

    /** @inheritDoc */
    public copyTo(target: Tag, overwrite: boolean): void {
        Guards.truthy(target, "target");
        if (target.tagTypes !== TagTypes.Id3v2) {
            super.copyTo(target, overwrite);
            return;
        }
        const match = <Id3v2Tag> target;

        const frames = this._frameList.slice();
        while (frames.length > 0) {
            const ident = frames[0].frameId;
            let copy = true;
            if (overwrite) {
                match.removeFrames(ident);
            } else {
                for (const f of match._frameList) {
                    if (ByteVector.equal(f.frameId, ident)) {
                        copy = false;
                        break;
                    }
                }
            }

            let i = 0;
            while (i < frames.length) {
                if (ByteVector.equal(frames[i].frameId, ident)) {
                    if (copy) {
                        match._frameList.push(frames[i].clone());
                    }
                    frames.splice(i, 1);
                } else {
                    i++;
                }
            }
        }
    }

    /**
     * Gets all frames with a specific frame class type.
     * NOTE: This diverges from the .NET implementation due to the inability to do type checking
     * like in .NET (ie `x is y`). Instead type guards are added to each frame class which provides
     * the same functionality.
     * @param type Class type of the frame to find
     * @returns TFrame[] Array of frames with the specified class type
     */
    public getFramesByClassType<TFrame extends Frame>(type: FrameClassType): TFrame[] {
        Guards.notNullOrUndefined(type, "type");

        return this._frameList.filter((f) => f && f.frameClassType === type)
            .map((f) => <TFrame> f);
    }

    /**
     * Gets a list of frames with the specified identifier contained in the current instance.
     * NOTE: This implementation deviates a bit from the original .NET implementation due to the
     * inability to do `x is y` comparison by types in typescript without type guards.
     * {@paramref type} is the type guard for differentiating frame types. If all frames are needed
     * use {@see frames}.
     * @param type Type of frame to return
     * @param ident Identifier of the frame
     * @returns TFrame[] Array of frames with the desired frame identifier
     */
    public getFramesByIdentifier<TFrame extends Frame>(type: FrameClassType, ident: ByteVector): TFrame[] {
        Guards.notNullOrUndefined(type, "type");
        Guards.truthy(ident, "ident");
        if (ident.length !== 4) {
            throw new Error("Argument out of range: ident must be 4 characters");
        }

        return this._frameList.filter((f) => {
            return f && f.frameClassType === type && ByteVector.equal(f.frameId, ident);
        }).map((f) => <TFrame> f);
    }

    /**
     * Gets the text value from a specified text information frame (or URL frame if that was
     * specified).
     * @param ident Frame identifier of the text information frame to get the value from
     * @returns string Text of the specified frame, or `undefined` if no value was found
     */
    public getTextAsString(ident: ByteVector): string {
        Guards.truthy(ident, "ident");

        const frame = ident.get(0) === "W".codePointAt(0)
            ? UrlLinkFrame.get(this, ident, false)
            : TextInformationFrame.getTextInformationFrame(this, ident, false);

        const result = frame ? frame.toString() : undefined;
        return result || undefined;
    }

    /**
     * Removes a specified frame from the current instance.
     * @param frame Object to remove from the current instance
     */
    public removeFrame(frame: Frame): void {
        Guards.truthy(frame, "frame");

        const index = this._frameList.indexOf(frame);
        if (index >= 0) {
            this._frameList.splice(index, 1);
        }
    }

    /**
     * Removes all frames with a specified identifier from the current instance.
     * @param ident Identifier of the frames to remove
     */
    public removeFrames(ident: ByteVector): void {
        Guards.truthy(ident, "ident");
        if (ident.length !== 4) {
            throw new Error("Argument out of range: ident must be 4 characters");
        }

        for (let i = this._frameList.length - 1; i >= 0; i--) {
            if (ByteVector.equal(this._frameList[i].frameId, ident)) {
                this._frameList.splice(i, 1);
            }
        }
    }

    /**
     * Renders the current instance as a raw ID3v2 tag.
     * By default, tags will be rendered in the version they were loaded in and new tags using the
     * version specified by {@see defaultVersion}. If {@see forceDefaultVersion} is `true`, all
     * tags will be rendered using that version, except for tags with footers which must be in
     * version 4.
     * @returns ByteVector The rendered tag.
     */
    public render(): ByteVector {
        // Convert the perfmers role to the TMCL frame
        const ret: string[] = undefined;
        if (this._performersRole) {
            const map: {[key: string]: string} = {};
            for (let i = 0; i < this._performersRole.length; i++) {
                const insts = this._performersRole[i];
                if (!insts) {
                    continue;
                }

                const instList = insts.split(";");
                for (const iinst of instList) {
                    const inst = iinst.trim();

                    if (i < this.performers.length) {
                        const perf = this.performers[i];
                        if (inst in map) {
                            map[inst] += ", " + perf;
                        } else {
                            map[inst] = perf;
                        }
                    }
                }
            }

            // Convert dictionary to string
            for (const key of map.keys) {
                ret.push(key);
                ret.push(map[key]);
            }
        }

        this.setTextFrame(FrameTypes.TMCL, ...ret);

        // We need to render the "tag data" first so that we have to correct size to render in the
        // tag's header. The "tag data" (everything that is included in Header.tagSize) includes
        // the extended header, frames and padding, but does not include the tag's header or footer

        const hasFooter = (this._header.flags & HeaderFlags.FooterPresent) > 0;
        const unsyncAtFrameLevel = (this._header.flags & HeaderFlags.Unsynchronication) > 0
            && this.version >= 4;
        const unsyncAtTagLevel = (this._header.flags & HeaderFlags.Unsynchronication) > 0
            && this.version < 4;

        this._header.majorVersion = hasFooter ? 4 : this.version;

        const tagData = ByteVector.empty();

        // TODO: Render the extended header
        this._header.flags &= ~HeaderFlags.ExtendedHeader;

        // Loop through the frames rendering them and adding them to tag data
        for (const frame of this._frameList) {
            if (unsyncAtFrameLevel) {
                frame.flags |= Id3v2FrameFlags.Desynchronized;
            }
            if ((frame.flags & Id3v2FrameFlags.TagAlterPreservation) > 0 ) {
                continue;
            }

            try {
                tagData.addByteVector(frame.render(this._header.majorVersion));
            } catch (e) {
                // Swallow unimplemented exceptions
                if (!e.hasOwnProperty("isNotImplementedError")) {
                    throw e;
                }
            }
        }

        // Add unsynchronization bytes if necessary
        if (unsyncAtTagLevel) {
            SyncData.unsyncByteVector(tagData);
        }

        // Compute the amount of padding and append that to tag data
        if (!hasFooter) {
            const size = tagData.length < this._header.tagSize
                ? this._header.tagSize - tagData.length
                : 1024;
            tagData.addByteVector(ByteVector.fromSize(size));
        }

        return tagData;
    }

    /**
     * Replaces an existing frame with a new one in the list contained in the current instance, or
     * adds a new one if the existing one is not contained.
     * @param oldFrame Object to be replaced
     * @param newFrame Object to replace {@paramref oldFrame} with
     */
    public replaceFrame(oldFrame: Frame, newFrame: Frame): void {
        Guards.truthy(oldFrame, "oldFrame");
        Guards.truthy(newFrame, "newFrame");

        if (oldFrame === newFrame) {
            return;
        }

        const index = this._frameList.indexOf(oldFrame);
        if (index >= 0) {
            this._frameList[index] = newFrame;
        } else {
            this._frameList.push(newFrame);
        }
    }

    /**
     * Sets the numerica values for a specified text information frame.
     * If both {@paramref numerator} and {@paramref denominator} are `0`, the frame will be removed
     * from the tag. If {@paramref denominator} is zero, {@paramref numerator} will be stored by
     * itself. Otherwise the values will be stored as `{numerator}/{denominator}`.
     * @param ident Identity of the frame to set
     * @param numerator Value containing the top half of the fraction, or the number if
     *     {@paramref denominator} is zero
     * @param denominator Value containing the bottom half of the fraction
     * @param minPlaces Mininum number of digits to use to display the {@paramref numerator}, if
     *     the numerator has less than this number of digits, it will be filled with leading zeroes.
     */
    public setNumberFrame(ident: ByteVector, numerator: number, denominator: number, minPlaces: number = 1): void {
        Guards.truthy(ident, "ident");
        Guards.uint(numerator, "value");
        Guards.uint(denominator, "count");
        Guards.byte(minPlaces, "minPlaces");
        if (ident.length !== 4) {
            throw new Error("Argument out of range: ident must be 4 characters");
        }

        if (numerator === 0 && denominator === 0) {
            this.removeFrames(ident);
        } else if (denominator !== 0) {
            const formattedNumerator = numerator.toString().padStart(minPlaces, "0");
            this.setTextFrame(ident, `${formattedNumerator}/${denominator}`);
        } else {
            this.setTextFrame(ident, numerator.toString());
        }
    }

    /**
     * Sets the text for a specified text information frame.
     * @param ident Identifier of the frame to set the data for
     * @param text Text to set for the specified frame or `undefined`/`null`/`""` to remove all
     *     frames with that identifier.
     */
    public setTextFrame(ident: ByteVector, ...text: string[]): void {
        Guards.truthy(ident, "ident");
        if (ident.length !== 4) {
            throw new Error("Argument out of range: ident must be 4 characters");
        }

        // Check if all the elements provided are empty. If they are, remove the frame.
        let empty = true;

        if (text) {
            for (let i = 0; empty && i < text.length; i++) {
                if (text[i]) {
                    empty = false;
                }
            }
        }

        if (empty) {
            this.removeFrames(ident);
            return;
        }

        if (ident.get(0) === "W".codePointAt(0)) {
            const urlFrame = UrlLinkFrame.get(this, ident, true);
            urlFrame.text = text;
            urlFrame.textEncoding = Id3v2Tag.defaultEncoding;
        } else {
            const frame = TextInformationFrame.getTextInformationFrame(this, ident, true);
            frame.text = text;
            frame.textEncoding = Id3v2Tag.defaultEncoding;
        }
    }

    // #endregion

    // #region Protected/Private Methods

    protected parse(data: ByteVector, file: File, position: number, style: ReadStyle): void {
        // If the entire tag is marked as unsynchronized, and this tag is version ID3v2.3 or lower,
        // resynchronize it.
        const fullTagUnsync = this._header.majorVersion < 4
            && (this._header.flags & HeaderFlags.Unsynchronication) > 0;

        // Avoid loading all the ID3 tag if PictureLazy is enabled and size is significant enough
        // (ID3v2.4 and later only)
        if (data && (
            fullTagUnsync ||
            this._header.tagSize < 1024 ||
            (style & ReadStyle.PictureLazy) > 0 ||
            (this._header.flags & HeaderFlags.ExtendedHeader) > 0
        )) {
            file.seek(position);
            data = file.readBlock(this._header.tagSize);
        }

        if (fullTagUnsync) {
            SyncData.resyncByteVector(data);
        }

        let frameDataPosition = data ? 0 : position;
        let frameDataEndPosition = (data ? data.length : this._header.tagSize)
            + frameDataPosition - Id3v2FrameHeader.getSize(this._header.majorVersion);

        // Check for the extended header
        if ((this._header.flags & HeaderFlags.ExtendedHeader) > 0) {
            this._extendedHeader = ExtendedHeader.fromData(data, this._header.majorVersion);

            if (this._extendedHeader.size <= data.length) {
                frameDataPosition += this._extendedHeader.size;
                frameDataEndPosition -= this._extendedHeader.size;
            }
        }

        // Parse the frames. TDRC, TDAT, and TIME will be needed for post-processing, so check for
        // for them as they are loaded
        let tdrc: TextInformationFrame;
        let tyer: TextInformationFrame;
        let tdat: TextInformationFrame;
        let time: TextInformationFrame;

        while (frameDataPosition < frameDataEndPosition) {
            let frame: Frame;

            try {
                const frameRead = FrameFactory.createFrame(
                    data,
                    file,
                    frameDataPosition,
                    this._header.majorVersion,
                    fullTagUnsync
                );
                frame = frameRead.frame;
                frameDataPosition = frameRead.offset;
            } catch (e) {
                if (!e.hasOwnProperty("isNotImplementedError") && !e.hasOwnProperty("isCorruptFileError")) {
                    throw e;
                } else {
                    continue;
                }
            }

            if (!frame) {
                break;
            }

            // Only add frames that contain data
            if (frame.size === 0) {
                continue;
            }

            this.addFrame(frame);

            // If the tag is version 4, no post-processing needed
            if (this._header.majorVersion === 4) {
                continue;
            }

            // Load up the first instance of each for post-processing
            if (!tdrc && ByteVector.equal(frame.frameId, FrameTypes.TDRC)) {
                tdrc = <TextInformationFrame> frame;
            } else if (!tyer && ByteVector.equal(frame.frameId, FrameTypes.TYER)) {
                tyer = <TextInformationFrame> frame;
            } else if (!tdat && ByteVector.equal(frame.frameId, FrameTypes.TDAT)) {
                tdat = <TextInformationFrame> frame;
            } else if (!time && ByteVector.equal(frame.frameId, FrameTypes.TIME)) {
                time = <TextInformationFrame> frame;
            }
        }

        // Try to fill out the data/time of the TDRC frame. Can't do that if no TDRC frame exists,
        // or if there is no TDAT frame, or if TDRC already has the date.
        if (!tdrc || !tdat || tdrc.toString().length !== 4) {
            return;
        }

        // Start with the year already in TDRC, then add the TDAT and TIME if available
        let tdrcText = tdrc.toString();

        // Add the data
        if (tdat) {
            const tdatText = tdat.toString();
            if (tdatText.length === 4) {
                tdrcText += `-${tdatText.substr(0, 2)}-${tdatText.substr(2, 2)}`;

                // Add the time
                if (time) {
                    const timeText = time.toString();

                    if (timeText.length === 4) {
                        tdrcText += `T${timeText.substr(0, 2)}:${timeText.substr(2, 2)}`;
                    }

                    this.removeFrames(FrameTypes.TDAT);
                }
            }

            tdrc.text = [tdrcText.toString()];
        }
    }

    protected read(file: File, position: number, style: ReadStyle): void {
        Guards.truthy(file, "file");
        Guards.uint(position, "position");

        file.mode = FileAccessMode.Read;

        if (position > file.length - Header.size) {
            throw new Error("Argument out of range: position must be less than the length of the file");
        }

        file.seek(position);

        this._header = new Header(file.readBlock(Header.size));

        // If the tag size is 0, then this is an invalid tag. Tags must contain at least one frame.
        if (this._header.tagSize === 0) {
            return;
        }

        position += Header.size;
        this.parse(undefined, file, position, style);
    }

    private getTextAsArray(ident: ByteVector): string[] {
        const frame = TextInformationFrame.getTextInformationFrame(this, ident, false);
        return frame ? frame.text : [];
    }

    private getTextAsUint32(ident: ByteVector, index: number): number {
        const text = this.getTextAsString(ident);
        if (text === null || text === undefined) {
            return 0;
        }

        const values = text.split("/", index + 2);
        if (values.length < index + 1) {
            return 0;
        }

        const asNumber = parseInt(values[index], 10);
        if (Number.isNaN(asNumber)) {
            return 0;
        }

        return asNumber;
    }

    private getUfidText(owner: string): string {
        // Get the UFID frame, frame will be undefined if nonexistent
        const frame = UniqueFileIdentifierFrame.get(this, owner, false);

        // If the frame existed, frame.identifier is a bytevector, get a string
        const result = frame ? frame.identifier.toString() : undefined;
        return result || undefined;
    }

    private getUserTextAsString(description: string, caseSensitive: boolean = true): string {
        // Gets the TXXX frame, frame will be undefined if nonexistant
        const frame = UserTextInformationFrame.getUserTextInformationFrame(
            this,
            description,
            false,
            Id3v2Tag.defaultEncoding,
            caseSensitive
        );

        // TXXX frames support multi-value strings, join them up and return only the text from the
        // frame
        const result = frame ? frame.text.join(";") : undefined;        // TODO: Consider escaping ';' before joining?
        return result || undefined;
    }

    private makeFirstOfType(frame: Frame): void {
        const type = frame.frameId;

        let swapping: Frame;
        for (let i = 0; i < this._frameList.length; i++) {
            if (!swapping) {
                if (ByteVector.equal(this._frameList[i].frameId, type)) {
                    swapping = frame;
                } else {
                    continue;
                }
            }

            const tmp = this._frameList[i];
            this._frameList[i] = swapping;
            swapping = tmp;

            if (swapping === frame) {
                return;
            }
        }

        if (swapping) {
            this._frameList.push(swapping);
        }
    }

    private setUfidText(owner: string, text: string): void {
        // Get the UFID frame, create if necessary
        const frame = UniqueFileIdentifierFrame.get(this, owner, true);

        // If we have a real string, convert to bytevector and apply to frame
        if (text) {
            const identifier = ByteVector.fromString(text, StringType.UTF8);
            frame.identifier = identifier;
        } else {
            // String was falsy, remove the frame to prevent empties
            this.removeFrame(frame);
        }
    }

    private setUserTextAsString(description: string, text: string, caseSensitive: boolean = true): void {
        // Get the TXXX frame, create a new one if needed
        const frame = UserTextInformationFrame.getUserTextInformationFrame(
            this,
            description,
            true,
            Id3v2Tag.defaultEncoding,
            caseSensitive);

        if (!text) {
            this.removeFrame(frame);
        } else {
            frame.text = text.split(";");
        }
    }

    // #endregion
}
