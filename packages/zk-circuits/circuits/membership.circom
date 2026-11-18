pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/**
 * Membership: proves the holder's credential element is inside the issuer's
 * Merkle tree (tree of valid credential hashes) without revealing which leaf.
 *
 * - leaf        : private (Poseidon(credentialHash))
 * - pathIndices : private (bits)  -> converted to 0/1 inside
 * - pathElements: private (siblings)
 * - root        : public
 *
 * Depth is fixed at 8 (256 leaves) for the demo.
 */
template Membership(levels) {
    signal input leaf;
    signal input pathIndices[levels];
    signal input pathElements[levels];
    signal input root;

    signal output out;

    signal bitChecks[levels];
    signal lefts[levels];
    signal rights[levels];
    signal calc[levels + 1];

    component bits[levels];
    component hashers[levels];

    calc[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        // enforce pathIndices[i] in {0,1} via (x)(x-1) = 0
        bitChecks[i] <== pathIndices[i] * (pathIndices[i] - 1);
        bitChecks[i] === 0;

        hashers[i] = Poseidon(2);
        // left = calc[i] if bit==0 else pathElements[i]
        // right = pathElements[i] if bit==0 else calc[i]
        lefts[i] <== calc[i] + (pathElements[i] - calc[i]) * pathIndices[i];
        rights[i] <== pathElements[i] + (calc[i] - pathElements[i]) * pathIndices[i];
        hashers[i].inputs[0] <== lefts[i];
        hashers[i].inputs[1] <== rights[i];
        calc[i + 1] <== hashers[i].out;
    }

    root === calc[levels];
    out <== 1;
}

component main {public [root]} = Membership(8);
