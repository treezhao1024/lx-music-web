// qq_qrc.js
import zlib from "zlib";

// QQ key（与你 C# 代码一致）
const QQKey = Buffer.from("!@#)(*$%123ZXC!@!@#)(NHL", "ascii");

// -----------------------------
// Hex → Buffer
// -----------------------------
function hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return Buffer.from(bytes);
}

// -----------------------------
// DES Helper (完整移植自 C#)
// -----------------------------
class DESHelper {
    static ENCRYPT = 1;
    static DECRYPT = 0;

    static BITNUM(a, b, c) {
        // a: Uint8Array/Buffer
        const idx = Math.floor(b / 32) * 4 + 3 - Math.floor((b % 32) / 8);
        const bit = (a[idx] >> (7 - (b % 8))) & 0x01;
        return (bit << c) >>> 0;
    }

    static BITNUMINTR(a, b, c) {
        const bit = (a >>> (31 - b)) & 0x00000001;
        return (bit << c) & 0xFF;
    }

    static BITNUMINTL(a, b, c) {
        return (((a << b) & 0x80000000) >>> c) >>> 0;
    }

    static SBOXBIT(a) {
        return ((a & 0x20) | ((a & 0x1f) >> 1) | ((a & 0x01) << 4)) & 0x3F;
    }

    static sbox1 = Uint8Array.from([
        14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,
        0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,
        4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,
        15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13
    ]);

    static sbox2 = Uint8Array.from([
        15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,
        3,13,4,7,15,2,8,15,12,0,1,10,6,9,11,5,
        0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,
        13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9
    ]);

    static sbox3 = Uint8Array.from([
        10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,
        13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,
        13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,
        1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12
    ]);

    static sbox4 = Uint8Array.from([
        7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,
        13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,
        10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,
        3,15,0,6,10,10,13,8,9,4,5,11,12,7,2,14
    ]);

    static sbox5 = Uint8Array.from([
        2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,
        14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,
        4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,
        11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3
    ]);

    static sbox6 = Uint8Array.from([
        12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,
        10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,
        9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,
        4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13
    ]);

    static sbox7 = Uint8Array.from([
        4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,
        13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,
        1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,
        6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12
    ]);

    static sbox8 = Uint8Array.from([
        13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,
        1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,
        7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,
        2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11
    ]);

    static KeySchedule(keyBytes, schedule, mode) {
        const key = Uint8Array.from(keyBytes);
        let C = 0 >>> 0;
        let D = 0 >>> 0;

        const key_rnd_shift = [
            1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1
        ];
        const key_perm_c = [
            56,48,40,32,24,16,8,0,57,49,41,33,25,17,
            9,1,58,50,42,34,26,18,10,2,59,51,43,35
        ];
        const key_perm_d = [
            62,54,46,38,30,22,14,6,61,53,45,37,29,21,
            13,5,60,52,44,36,28,20,12,4,27,19,11,3
        ];
        const key_compression = [
            13,16,10,23,0,4,2,27,14,5,20,9,
            22,18,11,3,25,7,15,6,26,19,12,1,
            40,51,30,36,46,54,29,39,50,44,32,47,
            43,48,38,55,33,52,45,41,49,35,28,31
        ];

        for (let i = 0, j = 31; i < 28; ++i, --j) {
            C |= DESHelper.BITNUM(key, key_perm_c[i], j);
        }
        for (let i = 0, j = 31; i < 28; ++i, --j) {
            D |= DESHelper.BITNUM(key, key_perm_d[i], j);
        }

        for (let i = 0; i < 16; ++i) {
            const shift = key_rnd_shift[i];
            C = (((C << shift) | (C >>> (28 - shift))) & 0xfffffff0) >>> 0;
            D = (((D << shift) | (D >>> (28 - shift))) & 0xfffffff0) >>> 0;

            const toGen = (mode === DESHelper.DECRYPT) ? (15 - i) : i;

            for (let j = 0; j < 6; ++j) {
                schedule[toGen][j] = 0;
            }

            let j = 0;
            for (; j < 24; ++j) {
                schedule[toGen][Math.floor(j / 8)] |= DESHelper.BITNUMINTR(C, key_compression[j], 7 - (j % 8));
            }
            for (; j < 48; ++j) {
                schedule[toGen][Math.floor(j / 8)] |= DESHelper.BITNUMINTR(D, key_compression[j] - 27, 7 - (j % 8));
            }
        }
    }

    static IP(state, input) {
        const a = input;
        state[0] =
            DESHelper.BITNUM(a,57,31)|DESHelper.BITNUM(a,49,30)|DESHelper.BITNUM(a,41,29)|DESHelper.BITNUM(a,33,28)|
            DESHelper.BITNUM(a,25,27)|DESHelper.BITNUM(a,17,26)|DESHelper.BITNUM(a,9,25)|DESHelper.BITNUM(a,1,24)|
            DESHelper.BITNUM(a,59,23)|DESHelper.BITNUM(a,51,22)|DESHelper.BITNUM(a,43,21)|DESHelper.BITNUM(a,35,20)|
            DESHelper.BITNUM(a,27,19)|DESHelper.BITNUM(a,19,18)|DESHelper.BITNUM(a,11,17)|DESHelper.BITNUM(a,3,16)|
            DESHelper.BITNUM(a,61,15)|DESHelper.BITNUM(a,53,14)|DESHelper.BITNUM(a,45,13)|DESHelper.BITNUM(a,37,12)|
            DESHelper.BITNUM(a,29,11)|DESHelper.BITNUM(a,21,10)|DESHelper.BITNUM(a,13,9)|DESHelper.BITNUM(a,5,8)|
            DESHelper.BITNUM(a,63,7)|DESHelper.BITNUM(a,55,6)|DESHelper.BITNUM(a,47,5)|DESHelper.BITNUM(a,39,4)|
            DESHelper.BITNUM(a,31,3)|DESHelper.BITNUM(a,23,2)|DESHelper.BITNUM(a,15,1)|DESHelper.BITNUM(a,7,0);

        state[1] =
            DESHelper.BITNUM(a,56,31)|DESHelper.BITNUM(a,48,30)|DESHelper.BITNUM(a,40,29)|DESHelper.BITNUM(a,32,28)|
            DESHelper.BITNUM(a,24,27)|DESHelper.BITNUM(a,16,26)|DESHelper.BITNUM(a,8,25)|DESHelper.BITNUM(a,0,24)|
            DESHelper.BITNUM(a,58,23)|DESHelper.BITNUM(a,50,22)|DESHelper.BITNUM(a,42,21)|DESHelper.BITNUM(a,34,20)|
            DESHelper.BITNUM(a,26,19)|DESHelper.BITNUM(a,18,18)|DESHelper.BITNUM(a,10,17)|DESHelper.BITNUM(a,2,16)|
            DESHelper.BITNUM(a,60,15)|DESHelper.BITNUM(a,52,14)|DESHelper.BITNUM(a,44,13)|DESHelper.BITNUM(a,36,12)|
            DESHelper.BITNUM(a,28,11)|DESHelper.BITNUM(a,20,10)|DESHelper.BITNUM(a,12,9)|DESHelper.BITNUM(a,4,8)|
            DESHelper.BITNUM(a,62,7)|DESHelper.BITNUM(a,54,6)|DESHelper.BITNUM(a,46,5)|DESHelper.BITNUM(a,38,4)|
            DESHelper.BITNUM(a,30,3)|DESHelper.BITNUM(a,22,2)|DESHelper.BITNUM(a,14,1)|DESHelper.BITNUM(a,6,0);
    }

    static InvIP(state, input) {
        const s0 = state[0];
        const s1 = state[1];

        input[3] =
            (DESHelper.BITNUMINTR(s1,7,7)|DESHelper.BITNUMINTR(s0,7,6)|DESHelper.BITNUMINTR(s1,15,5)|
             DESHelper.BITNUMINTR(s0,15,4)|DESHelper.BITNUMINTR(s1,23,3)|DESHelper.BITNUMINTR(s0,23,2)|
             DESHelper.BITNUMINTR(s1,31,1)|DESHelper.BITNUMINTR(s0,31,0)) & 0xFF;

        input[2] =
            (DESHelper.BITNUMINTR(s1,6,7)|DESHelper.BITNUMINTR(s0,6,6)|DESHelper.BITNUMINTR(s1,14,5)|
             DESHelper.BITNUMINTR(s0,14,4)|DESHelper.BITNUMINTR(s1,22,3)|DESHelper.BITNUMINTR(s0,22,2)|
             DESHelper.BITNUMINTR(s1,30,1)|DESHelper.BITNUMINTR(s0,30,0)) & 0xFF;

        input[1] =
            (DESHelper.BITNUMINTR(s1,5,7)|DESHelper.BITNUMINTR(s0,5,6)|DESHelper.BITNUMINTR(s1,13,5)|
             DESHelper.BITNUMINTR(s0,13,4)|DESHelper.BITNUMINTR(s1,21,3)|DESHelper.BITNUMINTR(s0,21,2)|
             DESHelper.BITNUMINTR(s1,29,1)|DESHelper.BITNUMINTR(s0,29,0)) & 0xFF;

        input[0] =
            (DESHelper.BITNUMINTR(s1,4,7)|DESHelper.BITNUMINTR(s0,4,6)|DESHelper.BITNUMINTR(s1,12,5)|
             DESHelper.BITNUMINTR(s0,12,4)|DESHelper.BITNUMINTR(s1,20,3)|DESHelper.BITNUMINTR(s0,20,2)|
             DESHelper.BITNUMINTR(s1,28,1)|DESHelper.BITNUMINTR(s0,28,0)) & 0xFF;

        input[7] =
            (DESHelper.BITNUMINTR(s1,3,7)|DESHelper.BITNUMINTR(s0,3,6)|DESHelper.BITNUMINTR(s1,11,5)|
             DESHelper.BITNUMINTR(s0,11,4)|DESHelper.BITNUMINTR(s1,19,3)|DESHelper.BITNUMINTR(s0,19,2)|
             DESHelper.BITNUMINTR(s1,27,1)|DESHelper.BITNUMINTR(s0,27,0)) & 0xFF;

        input[6] =
            (DESHelper.BITNUMINTR(s1,2,7)|DESHelper.BITNUMINTR(s0,2,6)|DESHelper.BITNUMINTR(s1,10,5)|
             DESHelper.BITNUMINTR(s0,10,4)|DESHelper.BITNUMINTR(s1,18,3)|DESHelper.BITNUMINTR(s0,18,2)|
             DESHelper.BITNUMINTR(s1,26,1)|DESHelper.BITNUMINTR(s0,26,0)) & 0xFF;

        input[5] =
            (DESHelper.BITNUMINTR(s1,1,7)|DESHelper.BITNUMINTR(s0,1,6)|DESHelper.BITNUMINTR(s1,9,5)|
             DESHelper.BITNUMINTR(s0,9,4)|DESHelper.BITNUMINTR(s1,17,3)|DESHelper.BITNUMINTR(s0,17,2)|
             DESHelper.BITNUMINTR(s1,25,1)|DESHelper.BITNUMINTR(s0,25,0)) & 0xFF;

        input[4] =
            (DESHelper.BITNUMINTR(s1,0,7)|DESHelper.BITNUMINTR(s0,0,6)|DESHelper.BITNUMINTR(s1,8,5)|
             DESHelper.BITNUMINTR(s0,8,4)|DESHelper.BITNUMINTR(s1,16,3)|DESHelper.BITNUMINTR(s0,16,2)|
             DESHelper.BITNUMINTR(s1,24,1)|DESHelper.BITNUMINTR(s0,24,0)) & 0xFF;
    }

    static F(state, key) {
        const lrgstate = new Uint8Array(6);
        let t1, t2;

        t1 =
            DESHelper.BITNUMINTL(state,31,0) |
            ((state & 0xf0000000) >>> 1) |
            DESHelper.BITNUMINTL(state,4,5) |
            DESHelper.BITNUMINTL(state,3,6) |
            ((state & 0x0f000000) >>> 3) |
            DESHelper.BITNUMINTL(state,8,11) |
            DESHelper.BITNUMINTL(state,7,12) |
            ((state & 0x00f00000) >>> 5) |
            DESHelper.BITNUMINTL(state,12,17) |
            DESHelper.BITNUMINTL(state,11,18) |
            ((state & 0x000f0000) >>> 7) |
            DESHelper.BITNUMINTL(state,16,23);

        t2 =
            DESHelper.BITNUMINTL(state,15,0) |
            ((state & 0x0000f000) << 15) |
            DESHelper.BITNUMINTL(state,20,5) |
            DESHelper.BITNUMINTL(state,19,6) |
            ((state & 0x00000f00) << 13) |
            DESHelper.BITNUMINTL(state,24,11) |
            DESHelper.BITNUMINTL(state,23,12) |
            ((state & 0x000000f0) << 11) |
            DESHelper.BITNUMINTL(state,28,17) |
            DESHelper.BITNUMINTL(state,27,18) |
            ((state & 0x0000000f) << 9) |
            DESHelper.BITNUMINTL(state,0,23);

        lrgstate[0] = (t1 >>> 24) & 0xFF;
        lrgstate[1] = (t1 >>> 16) & 0xFF;
        lrgstate[2] = (t1 >>> 8) & 0xFF;
        lrgstate[3] = (t2 >>> 24) & 0xFF;
        lrgstate[4] = (t2 >>> 16) & 0xFF;
        lrgstate[5] = (t2 >>> 8) & 0xFF;

        for (let i = 0; i < 6; i++) {
            lrgstate[i] ^= key[i];
        }

        let s = 0 >>> 0;
        s |= (DESHelper.sbox1[DESHelper.SBOXBIT(lrgstate[0] >>> 2)] << 28) >>> 0;
        s |= (DESHelper.sbox2[DESHelper.SBOXBIT(((lrgstate[0] & 0x03) << 4) | (lrgstate[1] >>> 4))] << 24) >>> 0;
        s |= (DESHelper.sbox3[DESHelper.SBOXBIT(((lrgstate[1] & 0x0f) << 2) | (lrgstate[2] >>> 6))] << 20) >>> 0;
        s |= (DESHelper.sbox4[DESHelper.SBOXBIT(lrgstate[2] & 0x3f)] << 16) >>> 0;
        s |= (DESHelper.sbox5[DESHelper.SBOXBIT(lrgstate[3] >>> 2)] << 12) >>> 0;
        s |= (DESHelper.sbox6[DESHelper.SBOXBIT(((lrgstate[3] & 0x03) << 4) | (lrgstate[4] >>> 4))] << 8) >>> 0;
        s |= (DESHelper.sbox7[DESHelper.SBOXBIT(((lrgstate[4] & 0x0f) << 2) | (lrgstate[5] >>> 6))] << 4) >>> 0;
        s |= DESHelper.sbox8[DESHelper.SBOXBIT(lrgstate[5] & 0x3f)] >>> 0;

        state =
            DESHelper.BITNUMINTL(s,15,0)|DESHelper.BITNUMINTL(s,6,1)|DESHelper.BITNUMINTL(s,19,2)|
            DESHelper.BITNUMINTL(s,20,3)|DESHelper.BITNUMINTL(s,28,4)|DESHelper.BITNUMINTL(s,11,5)|
            DESHelper.BITNUMINTL(s,27,6)|DESHelper.BITNUMINTL(s,16,7)|DESHelper.BITNUMINTL(s,0,8)|
            DESHelper.BITNUMINTL(s,14,9)|DESHelper.BITNUMINTL(s,22,10)|DESHelper.BITNUMINTL(s,25,11)|
            DESHelper.BITNUMINTL(s,4,12)|DESHelper.BITNUMINTL(s,17,13)|DESHelper.BITNUMINTL(s,30,14)|
            DESHelper.BITNUMINTL(s,9,15)|DESHelper.BITNUMINTL(s,1,16)|DESHelper.BITNUMINTL(s,7,17)|
            DESHelper.BITNUMINTL(s,23,18)|DESHelper.BITNUMINTL(s,13,19)|DESHelper.BITNUMINTL(s,31,20)|
            DESHelper.BITNUMINTL(s,26,21)|DESHelper.BITNUMINTL(s,2,22)|DESHelper.BITNUMINTL(s,8,23)|
            DESHelper.BITNUMINTL(s,18,24)|DESHelper.BITNUMINTL(s,12,25)|DESHelper.BITNUMINTL(s,29,26)|
            DESHelper.BITNUMINTL(s,5,27)|DESHelper.BITNUMINTL(s,21,28)|DESHelper.BITNUMINTL(s,10,29)|
            DESHelper.BITNUMINTL(s,3,30)|DESHelper.BITNUMINTL(s,24,31);

        return state >>> 0;
    }

    static Crypt(inputBytes, outputBytes, keySchedule) {
        const input = Uint8Array.from(inputBytes);
        const output = outputBytes;

        const state = new Uint32Array(2);
        DESHelper.IP(state, input);

        for (let idx = 0; idx < 15; ++idx) {
            const t = state[1];
            state[1] = (DESHelper.F(state[1], keySchedule[idx]) ^ state[0]) >>> 0;
            state[0] = t >>> 0;
        }

        state[0] = (DESHelper.F(state[1], keySchedule[15]) ^ state[0]) >>> 0;

        DESHelper.InvIP(state, output);
    }

    static TripleDESKeySetup(key, schedule, mode) {
        if (mode === DESHelper.ENCRYPT) {
            DESHelper.KeySchedule(key.slice(0, 8), schedule[0], mode);
            DESHelper.KeySchedule(key.slice(8, 16), schedule[1], DESHelper.DECRYPT);
            DESHelper.KeySchedule(key.slice(16, 24), schedule[2], mode);
        } else {
            DESHelper.KeySchedule(key.slice(0, 8), schedule[2], mode);
            DESHelper.KeySchedule(key.slice(8, 16), schedule[1], DESHelper.ENCRYPT);
            DESHelper.KeySchedule(key.slice(16, 24), schedule[0], mode);
        }
    }

    static TripleDESCrypt(input, output, schedule) {
        DESHelper.Crypt(input, output, schedule[0]);
        DESHelper.Crypt(output, output, schedule[1]);
        DESHelper.Crypt(output, output, schedule[2]);
    }
}

// -----------------------------
// QRC 解密（等价 C# Decrypter.DecryptLyrics）
// -----------------------------
function decryptLyrics(encryptedHex) {
    const encryptedBytes = hexToBytes(encryptedHex);

    const schedule = Array.from({ length: 3 }, () =>
        Array.from({ length: 16 }, () => new Uint8Array(6))
    );

    DESHelper.TripleDESKeySetup(QQKey, schedule, DESHelper.DECRYPT);

    const data = Buffer.alloc(encryptedBytes.length);

    for (let i = 0; i < encryptedBytes.length; i += 8) {
        const sliceLength = Math.min(8, encryptedBytes.length - i);
        const block = Buffer.alloc(8);
        encryptedBytes.copy(block, 0, i, i + sliceLength);

        const temp = Buffer.alloc(8);
        DESHelper.TripleDESCrypt(block, temp, schedule);

        temp.copy(data, i, 0, sliceLength);
    }
    // 这里的 data 应该是 zlib 压缩数据（与 C# SharpZipLib InflaterInputStream 一致）
    const unzipped = zlib.inflateSync(data);
    return unzipped.toString("utf8");
}

// -----------------------------
// 示例调用
// const hex = "你的 QRC 十六进制字符串";
// console.log(decryptLyrics(hex));

export { decryptLyrics };

