// IAU abbreviations; Korean names follow KASI's constellation table (2020 Almanac, p.184).
// https://astro.kasi.re.kr/file/astro_almanac_pdf/20200624134708539.pdf
const names: Record<string, readonly [string, string]> = {
  And: ["안드로메다자리", "Andromeda"], Ant: ["공기펌프자리", "Antlia"],
  Aps: ["극락조자리", "Apus"], Aqr: ["물병자리", "Aquarius"],
  Aql: ["독수리자리", "Aquila"], Ara: ["제단자리", "Ara"],
  Ari: ["양자리", "Aries"], Aur: ["마차부자리", "Auriga"],
  Boo: ["목동자리", "Boötes"], Cae: ["조각칼자리", "Caelum"],
  Cam: ["기린자리", "Camelopardalis"], Cnc: ["게자리", "Cancer"],
  CVn: ["사냥개자리", "Canes Venatici"], CMa: ["큰개자리", "Canis Major"],
  CMi: ["작은개자리", "Canis Minor"], Cap: ["바다염소자리", "Capricornus"],
  Car: ["용골자리", "Carina"], Cas: ["카시오페아자리", "Cassiopeia"],
  Cen: ["센타우르스자리", "Centaurus"], Cep: ["세페우스자리", "Cepheus"],
  Cet: ["고래자리", "Cetus"], Cha: ["카멜레온자리", "Chamaeleon"],
  Cir: ["컴퍼스자리", "Circinus"], Col: ["비둘기자리", "Columba"],
  Com: ["머리털자리", "Coma Berenices"], CrA: ["남쪽왕관자리", "Corona Australis"],
  CrB: ["북쪽왕관자리", "Corona Borealis"], Crv: ["까마귀자리", "Corvus"],
  Crt: ["컵자리", "Crater"], Cru: ["남십자자리", "Crux"],
  Cyg: ["백조자리", "Cygnus"], Del: ["돌고래자리", "Delphinus"],
  Dor: ["황새치자리", "Dorado"], Dra: ["용자리", "Draco"],
  Equ: ["조랑말자리", "Equuleus"], Eri: ["에리다누스자리", "Eridanus"],
  For: ["화로자리", "Fornax"], Gem: ["쌍둥이자리", "Gemini"],
  Gru: ["두루미자리", "Grus"], Her: ["헤르쿨레스자리", "Hercules"],
  Hor: ["시계자리", "Horologium"], Hya: ["큰물뱀자리", "Hydra"],
  Hyi: ["물뱀자리", "Hydrus"], Ind: ["인디언자리", "Indus"],
  Lac: ["도마뱀자리", "Lacerta"], Leo: ["사자자리", "Leo"],
  LMi: ["작은사자자리", "Leo Minor"], Lep: ["토끼자리", "Lepus"],
  Lib: ["천칭자리", "Libra"], Lup: ["이리자리", "Lupus"],
  Lyn: ["살쾡이자리", "Lynx"], Lyr: ["거문고자리", "Lyra"],
  Men: ["멘사자리", "Mensa"], Mic: ["현미경자리", "Microscopium"],
  Mon: ["외뿔소자리", "Monoceros"], Mus: ["파리자리", "Musca"],
  Nor: ["직각자자리", "Norma"], Oct: ["팔분의자리", "Octans"],
  Oph: ["뱀주인자리", "Ophiuchus"], Ori: ["오리온자리", "Orion"],
  Pav: ["공작자리", "Pavo"], Peg: ["페가수스자리", "Pegasus"],
  Per: ["페르세우스자리", "Perseus"], Phe: ["봉황자리", "Phoenix"],
  Pic: ["화가자리", "Pictor"], Psc: ["물고기자리", "Pisces"],
  PsA: ["남쪽물고기자리", "Piscis Austrinus"], Pup: ["고물자리", "Puppis"],
  Pyx: ["나침반자리", "Pyxis"], Ret: ["그물자리", "Reticulum"],
  Sge: ["화살자리", "Sagitta"], Sgr: ["궁수자리", "Sagittarius"],
  Sco: ["전갈자리", "Scorpius"], Scl: ["조각가자리", "Sculptor"],
  Sct: ["방패자리", "Scutum"], Ser: ["뱀자리", "Serpens"],
  Sex: ["육분의자리", "Sextans"], Tau: ["황소자리", "Taurus"],
  Tel: ["망원경자리", "Telescopium"], Tri: ["삼각형자리", "Triangulum"],
  TrA: ["남쪽삼각형자리", "Triangulum Australe"], Tuc: ["큰부리새자리", "Tucana"],
  UMa: ["큰곰자리", "Ursa Major"], UMi: ["작은곰자리", "Ursa Minor"],
  Vel: ["돛자리", "Vela"], Vir: ["처녀자리", "Virgo"],
  Vol: ["날치자리", "Volans"], Vul: ["여우자리", "Vulpecula"],
};

export function constellationNames(code: string | null | undefined) {
  if (!code || !Object.hasOwn(names, code)) return undefined;
  const [nameKo, nameEn] = names[code];
  return { nameKo, nameEn, illustrationSrc: `/images/constellations/${code}.webp` };
}
