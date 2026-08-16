import { readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url);

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function fail(message) {
  throw new Error(message);
}

function assert(name, condition) {
  if (!condition) fail(name);
  console.log(`PASS ${name}`);
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) fail(`missing ${name}`);

  let depth = 0;
  let bodyStart = -1;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") {
      depth += 1;
      bodyStart = bodyStart < 0 ? index : bodyStart;
    }
    if (character === "}") {
      depth -= 1;
      if (bodyStart >= 0 && depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  fail(`unterminated ${name}`);
}

const rateLimit = read("features/entry/communityRegistration/public/rateLimit.ts");
const logFunction = extractFunction(rateLimit, "logRateLimitInfrastructureFailure");
const classifier = extractFunction(rateLimit, "classifyRedisInfrastructureFailure");

const approvedFailures = [
  "missing_network_identity",
  "missing_runtime_configuration",
  "redis_timeout",
  "redis_authentication",
  "redis_network",
  "redis_exception",
];

for (const failure of approvedFailures) {
  assert(
    `diagnostic category ${failure} is explicitly typed`,
    new RegExp(`\\| "${failure}"`).test(rateLimit),
  );
}

assert(
  "diagnostic logger emits only category token",
  /console\.warn\(`entry_cr_rate_limit_failure=\$\{failure\}`\);/.test(
    logFunction,
  ) && !/console\.warn\([^)]*,/.test(logFunction),
);
assert(
  "diagnostic logger cannot log raw error material",
  !/\berror\b|\bmessage\b|\bstack\b|\bcause\b|\bredisUrl\b|\bredisToken\b|\bhmacSecret\b|\bidentityParts\b|\bslug\b|\btokenHash\b|\beditTokenHash\b|\bnetworkIdentity\b/.test(
    logFunction,
  ),
);
assert(
  "no raw exception is logged anywhere in rate limiter",
  !/console\.(warn|error|log)\([^)]*\b(error|message|stack|cause)\b/.test(
    rateLimit,
  ),
);
assert(
  "authentication errors map to safe authentication category",
  /wrongpass\|unauthorized\|forbidden\|invalid token\|authentication/.test(
    classifier,
  ) && /return "redis_authentication"/.test(classifier),
);
assert(
  "timeout errors map to safe timeout category",
  /timeout\|timed out\|etimedout\|abort/.test(classifier) &&
    /return "redis_timeout"/.test(classifier),
);
assert(
  "URL and connectivity errors map to safe network category",
  /invalid url\|malformed url\|fetch failed\|network\|connect\|connection/.test(
    classifier,
  ) && /return "redis_network"/.test(classifier),
);
assert(
  "unknown Redis errors map to generic exception category",
  /return "redis_exception"/.test(classifier),
);
assert(
  "missing request identity logs only missing network identity",
  /checks\.some\(\(check\) => check === null\)[\s\S]*infrastructureUnavailable\("missing_network_identity"\)/.test(
    rateLimit,
  ),
);
assert(
  "missing runtime config logs only missing runtime configuration",
  /!config\.configured[\s\S]*infrastructureUnavailable\("missing_runtime_configuration"\)/.test(
    rateLimit,
  ),
);
assert(
  "limiter timeout logs only Redis timeout",
  /result\.reason === "timeout"[\s\S]*infrastructureUnavailable\("redis_timeout"\)/.test(
    rateLimit,
  ),
);
assert(
  "limiter catch logs only classified safe category",
  /catch \(error\) \{[\s\S]*infrastructureUnavailable\(classifyRedisInfrastructureFailure\(error\)\)/.test(
    rateLimit,
  ),
);

console.log("ENTRY-ONB-006 rate-limit diagnostic validation passed.");
