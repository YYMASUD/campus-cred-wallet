pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

/**
 * AttributeEquals: proves a hidden attribute equals a public value, while also
 * binding the attribute to a credential commitment so the verifier knows the
 * value really came from that credential.
 *
 * Private:
 *   attribute     : the claim value (e.g. numeric hash of "enrolled")
 *   salt          : random blinding salt
 * Public:
 *   expected      : public value to compare against
 *   commitment    : Poseidon(attribute, salt) — also stored in the VC
 *
 * Output: match (must be 1)
 */
template AttributeEquals() {
    signal input attribute;
    signal input salt;
    signal input expected;
    signal input commitment;

    signal output match;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== attribute;
    hasher.inputs[1] <== salt;
    hasher.out === commitment;

    component eq = IsEqual();
    eq.in[0] <== attribute;
    eq.in[1] <== expected;

    match <== eq.out;
}

component main {public [expected, commitment]} = AttributeEquals();
