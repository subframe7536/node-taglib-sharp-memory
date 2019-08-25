import Id3v2TagSettings from "./id3v2TagSettings";
import SyncData from "./syncData";
import {ByteVector} from "../byteVector";
import {CorruptFileError} from "../errors";
import {HeaderFlags} from "./headerFlags";
import {Guards} from "../utils";

export default class Footer {
    private static readonly _fileIdentifier: ByteVector = ByteVector.fromString("3DI", undefined, undefined, true);
    private _flags: HeaderFlags;
    private _majorVersion: number;
    private _revisionNumber: number;
    private _tagSize: number;

    private constructor() {}

    /**
     * Constructs and initializes a new instance by reading it from raw footer data.
     * @param data Raw data to build the instance from
     */
    public static fromData(data: ByteVector): Footer {
        Guards.truthy(data, "data");
        if (data.length < Id3v2TagSettings.footerSize) {
            throw new CorruptFileError("Provided data is smaller than object size.");
        }
        if (!data.startsWith(Footer.fileIdentifier)) {
            throw new CorruptFileError("Provided data does not start with the file identifier");
        }

        const footer = new Footer();
        footer._majorVersion = data.get(3);
        footer._revisionNumber = data.get(4);
        footer._flags = data.get(5);

        if (footer._majorVersion === 2 && (footer._flags & 127) > 0) {
            throw new CorruptFileError("Invalid flags set on version 2 tag");
        }
        if (footer._majorVersion === 3 && (footer._flags & 15) > 0) {
            throw new CorruptFileError("Invalid flags set on version 3 tag");
        }
        if (footer._majorVersion === 4 && (footer._flags & 7) > 0) {
            throw new CorruptFileError("Invalid flags set on version 4 tag");
        }

        for (let i = 6; i < 10; i++) {
            if (data.get(i) >= 128) {
                throw new CorruptFileError("One of the bytes in the header was greater than the allowed 128");
            }
        }

        footer.tagSize = SyncData.toUint(data.mid(6, 4));

        return footer;
    }

    // #region Properties

    /**
     * Identifier used to recognize an ID3v2 footer.
     */
    public static get fileIdentifier(): ByteVector { return this._fileIdentifier; }

    /**
     * Gets the complete size of the tag described by the current instance including the header
     * and footer.
     */
    public get completeTagSize(): number {
        return this.tagSize + Id3v2TagSettings.headerSize + Id3v2TagSettings.footerSize;
    }

    /**
     * Gets the flags applied to the current instance.
     */
    public get flags(): HeaderFlags { return this._flags; }
    /**
     * Sets the flags applied to the current instance.
     * @param value Bitwise combined {@see HeaderFlags} value containing the flags to apply to the
     *     current instance.
     */
    public set flags(value: HeaderFlags) {
        const version3Flags = HeaderFlags.ExtendedHeader | HeaderFlags.ExperimentalIndicator;
        if ((value & version3Flags) > 0 && this.majorVersion < 3) {
            throw new Error("Feature only supported in version 2.3+");
        }
        const version4Flags = HeaderFlags.FooterPresent;
        if ((value & version4Flags) > 0 && this.majorVersion < 4) {
            throw new Error("Feature only supported in version 2.4+");
        }

        this._flags = value;
    }

    /**
     * Sets the major version of the tag described by the current instance.
     */
    public get majorVersion(): number {
        return this._majorVersion === 0
            ? Id3v2TagSettings.defaultVersion
            : this._majorVersion;
    }
    /**
     * Sets the major version of the tag described by the current instance.
     * When the version is set, unsupported header flags will automatically be removed from the
     * tag.
     * @param value ID3v2 version if tag described by the current instance. Footers are only
     *     supported with version 4, so this value can only be 4.
     */
    public set majorVersion(value: number) {
        if (value !== 4) {
            throw new Error("Argument out of range: Version unsupported");
        }
        this._majorVersion = value;
    }

    /**
     * Gets the version revision number of the tag represented by the current instance.
     */
    public get revisionNumber(): number { return this._revisionNumber; }
    /**
     * Sets the version revision number of the tag represented by the current instance.
     * This value should always be zero. Non-zero values indicate an experimental or new version of
     * the format which may not be completely understood by the current version of
     * node-taglib-sharp. Some software may refuse to read tags with a non-zero value.
     * @param value Version revision number of the tag represented by the current instance. Must be
     *     an 8-bit unsigned integer.
     */
    public set revisionNumber(value: number) {
        Guards.byte(value, "value");
        this._revisionNumber = value;
    }

    /**
     * Gets the complete size of the tag described by the current instance, minus the header and
     * footer.
     */
    public get tagSize(): number { return this._tagSize; }
    /**
     * Sets the complete size of the tag described by the current instance, minus the header
     * footer.
     * @param value Size of the tag in bytes. Must be an unsigned 32-bit integer
     */
    public set tagSize(value: number) {
        Guards.uint(value, "value");
        this._tagSize = value;
    }

    // #endregion

    public render(): ByteVector {
        return ByteVector.concatenate(
            Footer.fileIdentifier,
            this.majorVersion,
            this.revisionNumber,
            this.flags,
            SyncData.fromUint(this.tagSize)
        );
    }
}
