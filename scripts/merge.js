// Sub-Store file script: splice collection/subscription nodes into the JSON template.
// Link: .../scripts/merge.js#type=1&name=Me
//   type=1 or col → collection; otherwise a single subscription
//   name → Sub-Store collection/subscription name

const { type, name } = $arguments;
const compatible = { tag: "COMPATIBLE", type: "direct" };

const REGION_FILTERS = [
  ["香港", /港|hk|hongkong|hong kong|🇭🇰/i],
  ["台湾", /台|tw|taiwan|🇹🇼/i],
  ["日本", /日|jp|japan|🇯🇵/i],
  ["新加坡", /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i],
  ["美国", /美|us|unitedstates|united states|🇺🇸/i],
];

const OTHER_REGION =
  /^(?!.*(?:🇭🇰|🇯🇵|🇺🇸|🇸🇬|🇨🇳|港|hk|hongkong|台|tw|taiwan|日|jp|japan|新|sg|singapore|美|us|unitedstates)).*$/i;

const LOCATIONS = ["香港", "台湾", "日本", "韩国", "美国", "新加坡"];

let config = JSON.parse($files[0]);
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? "collection" : "subscription",
  platform: "sing-box",
  produceType: "internal",
});

config.outbounds.push(...proxies);

const allTags = tagsOf(proxies);
fill("手动选择", allTags);
fill("全端口", allTags);
fill("香港", tagsOf(proxies, REGION_FILTERS[0][1]));
fill("台湾", tagsOf(proxies, REGION_FILTERS[1][1]));
fill("日本", tagsOf(proxies, REGION_FILTERS[2][1]));
fill("新加坡", tagsOf(proxies, REGION_FILTERS[3][1]));
fill("美国", tagsOf(proxies, REGION_FILTERS[4][1]));
fill(
  "其它地区",
  proxies.filter((p) => OTHER_REGION.test(p.tag)).map((p) => p.tag),
);

let usedCompatible = false;
function ensureCompatible() {
  if (usedCompatible) return;
  config.outbounds.push(compatible);
  usedCompatible = true;
}

wireLanding(proxies);

for (const outbound of config.outbounds) {
  if (!Array.isArray(outbound.outbounds) || outbound.outbounds.length > 0) {
    continue;
  }
  ensureCompatible();
  outbound.outbounds.push(compatible.tag);
}

$content = JSON.stringify(config, null, 2);

function tagsOf(list, regex) {
  return (regex ? list.filter((p) => regex.test(p.tag)) : list).map((p) => p.tag);
}

function fill(tag, tags) {
  const outbound = config.outbounds.find((item) => item.tag === tag);
  if (outbound && Array.isArray(outbound.outbounds)) {
    outbound.outbounds.push(...tags);
  }
}

function wireLanding(list) {
  const landingByLoc = new Map();
  for (const proxy of list) {
    if (!proxy.tag.includes("落地")) continue;
    const loc = LOCATIONS.find((item) => proxy.tag.includes(item));
    if (!loc) continue;
    proxy.detour = `${loc}落地中转`;
    if (!landingByLoc.has(loc)) landingByLoc.set(loc, []);
    landingByLoc.get(loc).push(proxy.tag);
  }
  if (landingByLoc.size === 0) return;

  const nonLanding = allTags.filter((tag) => !tag.includes("落地"));
  const extraGroupNames = [];
  for (const [loc, tags] of landingByLoc) {
    extraGroupNames.push(`${loc}落地`);
    config.outbounds.push({
      tag: `${loc}落地`,
      type: "selector",
      outbounds: tags,
    });
    if (nonLanding.length === 0) ensureCompatible();
    config.outbounds.push({
      tag: `${loc}落地中转`,
      type: "selector",
      outbounds: nonLanding.length > 0 ? nonLanding : [compatible.tag],
    });
  }
  for (const outbound of config.outbounds) {
    if (outbound.type !== "selector") continue;
    if (!Array.isArray(outbound.outbounds)) continue;
    if (outbound.tag.endsWith("落地") || outbound.tag.endsWith("落地中转")) {
      continue;
    }
    for (const name of extraGroupNames) {
      if (!outbound.outbounds.includes(name)) outbound.outbounds.push(name);
    }
  }
}
