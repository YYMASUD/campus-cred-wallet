pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";

/**
 * NonRevocation: proves that a credential's status index is NOT revoked in the
 * issuer's revocation bitmap, WITHOUT revealing the index.
 *
 * Private: statusIndex, bitmapBits[256]
 * Public:  word (256-bit bitmap word from chain), issuerHash, page
 * Output:  clear (1 iff the proof is valid)
 *
 * Soundness:
 *  1. every bitmapBits[i] is binary
 *  2. Bits2Num(bitmapBits) == word  -> bits are exactly the on-chain word
 *  3. statusIndex < 16384 (16 pages * 1024 bits)
 *  4. the bit selected by statusIndex's low 8 bits must be 0
 */
template NonRevocation() {
    signal input statusIndex;     // private
    signal input bitmapBits[256]; // private
    signal input word;            // public
    signal input issuerHash;      // public
    signal input page;            // public

    signal output clear;

    signal bitChecks[256];
    signal matchTerms[256][9];
    signal onehot[256];
    signal total[257];

    component recompose = Bits2Num(256);
    component statusRange = LessThan(15);
    component idxBits = Num2Bits(14);

    // 1 + 2: bits are binary and recompose exactly to the public word
    for (var i = 0; i < 256; i++) {
        bitChecks[i] <== bitmapBits[i] * (bitmapBits[i] - 1);
        bitChecks[i] === 0;
        recompose.in[i] <== bitmapBits[i];
    }
    recompose.out === word;

    // 3: statusIndex in range
    statusRange.in[0] <== statusIndex;
    statusRange.in[1] <== 16384;
    statusRange.out === 1;

    // 4: one-hot select the bit at (statusIndex % 256)
    idxBits.in <== statusIndex;

    total[0] <== 0;
    for (var i = 0; i < 256; i++) {
        matchTerms[i][0] <== 1;
        for (var b = 0; b < 8; b++) {
            if (((i >> b) & 1) == 1) {
                matchTerms[i][b + 1] <== matchTerms[i][b] * idxBits.out[b];
            } else {
                matchTerms[i][b + 1] <== matchTerms[i][b] * (1 - idxBits.out[b]);
            }
        }
        onehot[i] <== matchTerms[i][8] * bitmapBits[i];
        total[i + 1] <== total[i] + onehot[i];
    }

    total[256] === 0;
    clear <== 1;
}

component main {public [word, issuerHash, page]} = NonRevocation();




