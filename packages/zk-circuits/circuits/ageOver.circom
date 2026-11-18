pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";

/**
 * AgeOver: proves birthDate < cutoffDate without revealing birthDate.
 *
 * Inputs are dates encoded as YYYYMMDD integers (e.g. 20050131).
 * - birthDate   : private input (never revealed)
 * - cutoffDate  : public input (today minus X years, computed by the app)
 * - minAge      : public input (for UI display / binding, e.g. 18)
 *
 * Public outputs: [cutoffDate, minAge]
 * Constraint: birthDate < cutoffDate  (older than the cutoff)
 */
template AgeOver() {
    signal input birthDate;
    signal input cutoffDate;
    signal input minAge;

    signal output valid;

    component lt = LessThan(32);
    lt.in[0] <== birthDate;
    lt.in[1] <== cutoffDate;

    valid <== lt.out;
}

component main {public [cutoffDate, minAge]} = AgeOver();
