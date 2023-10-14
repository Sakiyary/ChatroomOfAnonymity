import assert from "node:assert";
import { sha256sum } from "./sha256";

// This is a textbook RSA implementation, which is not secure, only for learning purpose
// https://crypto.stackexchange.com/questions/1448/definition-of-textbook-rsa
// https://en.wikipedia.org/wiki/RSA_(cryptosystem)

// Return a ^ b % m
function binPow(a: bigint, b: bigint, m: bigint): bigint {
  a %= m;
  let res = 1n;
  while (b > 0n) {
    if (b % 2n === 1n) {
      res = (res * a) % m;
    }
    a = (a * a) % m;
    b /= 2n;
  }
  return res;
}

// Miller–Rabin primality test
// Reference: https://en.wikipedia.org/wiki/Miller%E2%80%93Rabin_primality_test
function isProbablyPrime(n: bigint, k: number): boolean {
  if (n % 2n === 0n) {
    // Are u kidding me?
    return false;
  }

  let r = 0;
  let d = n - 1n;

  while (d % 2n === 0n) {
    r += 1;
    d /= 2n;
  }

  for (let i = 0; i < k; i++) {
    // A not too large random witness between 2 and n - 1
    const witness = BigInt(
      Math.floor(Math.random() * (Math.min(Number(n) - 1, 100000) - 2 + 1)) + 2,
    );

    let x = binPow(witness, d, n);
    if (x === 1n || x === n - 1n) {
      continue;
    }

    let flag = false;
    for (let j = 1; j < r; j++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        flag = true;
        break;
      }
    }

    if (!flag) {
      return false;
    }
  }

  return true;
}

// Generate a big enough prime number
function bigPrime(): bigint {
  while (true) {
    const buf = new Uint8Array(129); // at least 1024-bit long
    crypto.getRandomValues(buf);

    // Make sure the first byte > 0
    if (buf[0] === 0) {
      buf[0] = 1;
    }

    // Make sure it's an odd number
    if (buf[buf.length - 1] % 2 === 0) {
      buf[buf.length - 1] += 1;
    }

    const n = BigInt(
      `0x${Array.from(buf)
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")}`,
    );
    if (isProbablyPrime(n, 20)) {
      return n;
    }
  }
}

// https://en.wikipedia.org/wiki/Extended_Euclidean_algorithm
function gcdExt(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === 0n) {
    return [a, 1n, 0n];
  }
  const [d, x, y] = gcdExt(b, a % b);
  return [d, y, x - y * (a / b)];
}

function modInverse(a: bigint, m: bigint): bigint {
  const [d, x, y] = gcdExt(a, m);
  assert(d === 1n, "gcd(a, m) !== 1");
  return ((x % m) + m) % m;
}

function rsaKeyGen(): { e: bigint; d: bigint; n: bigint } {
  const e = 65537n;
  const [p, q] = [bigPrime(), bigPrime()];

  const n = p * q;
  const phi = (p - 1n) * (q - 1n);

  const d = modInverse(e, phi);
  assert((e * d) % phi === 1n, "n * d % phi !== 1");

  return { e, d, n };
}

function rsaEncrypt(n: bigint, e: bigint, m: bigint): bigint {
  assert(m < n, "m >= n");
  return binPow(m, e, n);
}

function rsaDecrypt(n: bigint, d: bigint, c: bigint): bigint {
  return binPow(c, d, n);
}

function rsaSign(n: bigint, d: bigint, m: bigint) {
  return rsaEncrypt(n, d, m);
}

function rsaVerify(n: bigint, e: bigint, m: bigint, s: bigint): boolean {
  return rsaDecrypt(n, e, s) === m;
}

function rsaSignSHA256(n: bigint, d: bigint, msg: Uint8Array): bigint {
  const digest = sha256sum(msg);
  const m = BigInt(
    `0x${Array.from(digest)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")}`,
  );
  return rsaSign(n, d, m);
}

function rsaVerifySHA256(
  n: bigint,
  e: bigint,
  msg: Uint8Array,
  s: bigint,
): boolean {
  const digest = sha256sum(msg);
  const m = BigInt(
    `0x${Array.from(digest)
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")}`,
  );
  return rsaVerify(n, e, m, s);
}

// https://en.wikipedia.org/wiki/Blind_signature
function rsaBlindMask(n: bigint, e: bigint, r: bigint, m: bigint): bigint {
  return (m * binPow(r, e, n)) % n;
}

function rsaBlindUnmask(n: bigint, r: bigint, sig: bigint) {
  const rr = modInverse(r, n);
  return (sig * rr) % n;
}

export {
  isProbablyPrime,
  binPow,
  rsaKeyGen,
  rsaEncrypt,
  rsaDecrypt,
  rsaSign,
  rsaVerify,
  rsaSignSHA256,
  rsaVerifySHA256,
  rsaBlindMask,
  rsaBlindUnmask,
};
