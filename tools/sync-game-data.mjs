import { mkdir, writeFile } from "node:fs/promises";

const output = new URL("../src/catalog/", import.meta.url);
const heroAliases = {
  antimage:["敌法","AM"], axe:["斧头"], bane:["睡魔"], bloodseeker:["血魔","BS"],
  crystal_maiden:["冰女","CM"], drow_ranger:["小黑","黑弓","DR"], earthshaker:["小牛","神牛","ES"],
  juggernaut:["剑圣","JUGG"], mirana:["白虎","月女","POM"], nevermore:["影魔","SF"], morphling:["水人"],
  phantom_lancer:["猴子","PL"], puck:["仙女龙"], pudge:["屠夫","胖子"], razor:["电棍"], sand_king:["沙王","SK"],
  storm_spirit:["蓝猫"], sven:["流浪"], tiny:["小小","山岭巨人"], vengefulspirit:["复仇","VS"],
  windrunner:["风行","WR"], zuus:["宙斯","Zeus"], kunkka:["船长","Coco"], lina:["火女"], lion:["恶魔巫师"],
  shadow_shaman:["小Y","萨满"], slardar:["大鱼"], tidehunter:["潮汐"], witch_doctor:["巫医","WD"], lich:["巫妖"],
  riki:["隐刺","SA"], enigma:["谜团"], tinker:["修补匠","TK"], sniper:["火枪","矮子"], necrolyte:["死灵法","NEC"],
  warlock:["术士","WL"], beastmaster:["兽王"], queenofpain:["女王","QOP"], venomancer:["剧毒"], faceless_void:["虚空"],
  skeleton_king:["骷髅王","WK"], death_prophet:["死亡先知","DP"], phantom_assassin:["幻刺","PA"], pugna:["骨法"],
  templar_assassin:["圣堂","TA"], viper:["毒龙"], luna:["月骑"], dragon_knight:["龙骑","DK"], dazzle:["暗牧"],
  rattletrap:["发条"], leshrac:["老鹿"], furion:["先知","NP"], life_stealer:["小狗"], dark_seer:["兔子","黑贤","DS"],
  clinkz:["小骷髅","骨弓"], omniknight:["全能","OK"], enchantress:["小鹿"], huskar:["神灵"], night_stalker:["夜魔"],
  broodmother:["蜘蛛"], bounty_hunter:["赏金","BH"], weaver:["蚂蚁"], jakiro:["双头龙"], batrider:["蝙蝠"],
  chen:["圣骑"], spectre:["幽鬼"], doom_bringer:["末日","Doom"], ancient_apparition:["冰魂","AA"], ursa:["拍拍"],
  spirit_breaker:["白牛","SB"], gyrocopter:["飞机"], alchemist:["炼金"], invoker:["卡尔"], silencer:["沉默"],
  obsidian_destroyer:["黑鸟","OD"], lycan:["狼人"], brewmaster:["熊猫","酒仙"], shadow_demon:["毒狗","SD"],
  lone_druid:["熊德","LD"], chaos_knight:["混沌","CK"], meepo:["地卜","米波"], treant:["大树"], ogre_magi:["蓝胖"],
  undying:["尸王"], rubick:["大魔导"], disruptor:["萨尔"], nyx_assassin:["小强","NA"], naga_siren:["小娜迦"],
  keeper_of_the_light:["光法","KOTL"], wisp:["小精灵","IO"], visage:["死灵龙"], slark:["小鱼"], medusa:["一姐"],
  troll_warlord:["巨魔"], centaur:["人马"], magnataur:["猛犸"], shredder:["伐木机"], bristleback:["刚背","猪"],
  tusk:["海民"], skywrath_mage:["天怒"], abaddon:["亚巴顿","LOA"], elder_titan:["大牛","TC"],
  legion_commander:["军团","LC"], techies:["炸弹人","工程师"], ember_spirit:["火猫"], earth_spirit:["土猫"],
  abyssal_underlord:["大屁股","深渊领主"], terrorblade:["魂守","TB"], phoenix:["凤凰"], oracle:["神谕"],
  winter_wyvern:["冰龙"], arc_warden:["电狗"], monkey_king:["大圣","猴王","MK"], dark_willow:["花仙子"],
  pangolier:["滚滚","穿山甲"], grimstroke:["墨客"], hoodwink:["松鼠"], void_spirit:["紫猫"], snapfire:["老奶奶","奶奶"],
  mars:["玛尔斯"], dawnbreaker:["破晓","大锤妹"], marci:["玛西"], primal_beast:["兽"], muerta:["奶绿"], ringmaster:["马戏团"]
};

const itemAliases = {
  blink:["跳刀"], overwhelming_blink:["力量跳","红跳"], swift_blink:["敏捷跳","绿跳"], arcane_blink:["智力跳","蓝跳"],
  branches:["树枝"], magic_stick:["小魔棒"], magic_wand:["大魔棒","魔棒"], quelling_blade:["补刀斧"],
  power_treads:["假腿"], travel_boots:["飞鞋"], travel_boots_2:["大飞鞋"], tranquil_boots:["绿鞋"], phase_boots:["相位"],
  arcane_boots:["秘法"], bfury:["狂战"], black_king_bar:["BKB","黑黄"], monkey_king_bar:["MKB","金箍棒"],
  ultimate_scepter:["A杖","蓝杖"], aghanims_shard:["魔晶","碎片"], sheepstick:["羊刀"], orchid:["紫苑"], bloodthorn:["大紫苑"],
  force_staff:["推推","推推棒"], hurricane_pike:["大推推","长戟"], glimmer_cape:["微光"], shadow_amulet:["隐刀挂件"],
  invis_sword:["隐刀"], silver_edge:["大隐刀"], greater_crit:["大炮"], lesser_crit:["水晶剑"], basher:["晕锤"],
  abyssal_blade:["大晕锤"], heart:["龙心"], satanic:["撒旦"], skadi:["冰眼"], manta:["分身斧"],
  sphere:["林肯"], refresher:["刷新球"], octarine_core:["玲珑心"], radiance:["辉耀"], butterfly:["蝴蝶"],
  assault:["强袭"], shivas_guard:["冰甲","希瓦"], pipe:["笛子"], crimson_guard:["赤红甲"],
  spirit_vessel:["大骨灰"], urn_of_shadows:["骨灰"], hand_of_midas:["点金"], desolator:["黯灭"],
  diffusal_blade:["散失"], disperser:["大散失"], moon_shard:["银月"], gem:["真眼宝石","宝石"],
  ward_observer:["假眼","黄眼"], ward_sentry:["真眼","蓝眼"], smoke_of_deceit:["雾"], dust:["粉"],
  bottle:["魔瓶","瓶子"], lotus_orb:["莲花"], blade_mail:["刃甲"], vanguard:["先锋盾"],
  eternal_shroud:["永世法衣","法衣"], aeon_disk:["盘子"], cyclone:["风杖"], wind_waker:["大风杖"],
  helm_of_the_dominator:["支配"], helm_of_the_overlord:["大支配"], mask_of_madness:["疯脸"],
  armlet:["臂章"], echo_sabre:["连击刀"], harpoon:["鱼叉"], mage_slayer:["法师克星"],
  kaya:["慧光"], sange:["散华"], yasha:["夜叉"], kaya_and_sange:["慧夜对剑"], sange_and_yasha:["双刀"]
};

const [openHeroes, openItems, valveHeroes, valveItems] = await Promise.all([
  fetch("https://api.opendota.com/api/constants/heroes").then(r => r.json()),
  fetch("https://api.opendota.com/api/constants/items").then(r => r.json()),
  fetch("https://www.dota2.com/datafeed/herolist?language=schinese").then(r => r.json()),
  fetch("https://www.dota2.com/datafeed/itemlist?language=schinese").then(r => r.json())
]);

const zhHeroes = new Map(valveHeroes.result.data.heroes.map(hero => [hero.id, hero]));
const heroes = Object.values(openHeroes).map(hero => {
  const key = hero.name.replace("npc_dota_hero_", "");
  const localized = zhHeroes.get(hero.id);
  return {
    id: hero.id,
    key,
    name: localized?.name_loc || hero.localized_name,
    englishName: hero.localized_name,
    attribute: hero.primary_attr,
    aliases: heroAliases[key] || [],
    image: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${key}.png`
  };
}).sort((a,b) => a.id - b.id);

const openItemById = new Map(Object.entries(openItems).map(([key, item]) => [item.id, { key, ...item }]));
const items = valveItems.result.data.itemabilities
  .filter(item => item.name?.startsWith("item_") && item.name_loc && !item.name_loc.startsWith("#"))
  .map(item => {
    const key = item.name.replace("item_", "");
    const open = openItemById.get(item.id);
    return {
      id: item.id,
      key,
      name: item.name_loc,
      englishName: item.name_english_loc,
      aliases: itemAliases[key] || [],
      image: open?.img
        ? `https://cdn.cloudflare.steamstatic.com${open.img.split("?")[0]}`
        : `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${key}.png`
    };
  })
  .sort((a,b) => a.id - b.id);

await mkdir(output, { recursive: true });
await Promise.all([
  writeFile(new URL("heroes.json", output), JSON.stringify(heroes, null, 2) + "\n"),
  writeFile(new URL("items.json", output), JSON.stringify(items, null, 2) + "\n"),
  writeFile(new URL("meta.json", output), JSON.stringify({
    generatedAt: new Date().toISOString(),
    sources: ["Valve Dota 2 datafeed (schinese)", "OpenDota constants"],
    heroCount: heroes.length,
    itemCount: items.length
  }, null, 2) + "\n")
]);
console.log(`Saved ${heroes.length} heroes and ${items.length} items.`);
