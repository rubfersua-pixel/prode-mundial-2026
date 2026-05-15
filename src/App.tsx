// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from "react";

// --- FONT ---------------------------------------------------------------------
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@400;600;700&display=swap";
document.head.appendChild(fontLink);

const FONT = "'Barlow Condensed', 'Arial Narrow', Arial, sans-serif";
const FONT_BODY = "'Barlow', Arial, sans-serif";

// --- STORAGE ------------------------------------------------------------------
// --- SUPABASE CONFIG ----------------------------------------------------------
const SB_URL = "https://eyyavejigrwejdbbsrjj.supabase.co";
const SB_KEY = "sb_publishable_dGeHxkzz-IqmM3FrjgkElQ_u7eosvri";

const sbFetch = async (path, method="GET", body=null) => {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      "Prefer": method==="POST"?"resolution=merge-duplicates,return=minimal":method==="PATCH"?"return=minimal":"return=minimal",
    },
    body: body ? JSON.stringify(body) : null,
  });
  if(!res.ok && res.status !== 404) {
    const err = await res.text().catch(()=>"");
    console.error("Supabase error:", res.status, err);
  }
  if(method==="GET" && res.ok) return res.json();
  return null;
};

// Storage helpers - same interface as before
const sGetUser = async (username) => {
  const data = await sbFetch(`users?username=eq.${encodeURIComponent(username)}&select=username,password,full_name,approved`);
  return data?.[0] || null;
};

const sSetUser = async (username, password, fullName="") => {
  const res = await fetch(`${SB_URL}/rest/v1/users`, {
    method: "POST",
    headers: {
      "apikey": SB_KEY,
      "Authorization": `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({username, password, full_name: fullName, approved: false}),
  });
  if(!res.ok) console.error("sSetUser error:", res.status, await res.text().catch(()=>""));
};

const sApproveUser = async (username) => {
  await sbFetch(`users?username=eq.${encodeURIComponent(username)}`, "PATCH", {approved: true});
};

const sRejectUser = async (username) => {
  await sbFetch(`users?username=eq.${encodeURIComponent(username)}`, "DELETE");
};

const sGetPendingUsers = async () => {
  const data = await sbFetch(`users?approved=eq.false&username=neq.admin&select=username,full_name,created_at&order=created_at`);
  return data || [];
};

const sGetApprovedUsers = async () => {
  const data = await sbFetch(`users?approved=eq.true&username=neq.admin&select=username,full_name&order=username`);
  return data || [];
};

const sGetScores = async (username) => {
  const data = await sbFetch(`scores?username=eq.${encodeURIComponent(username)}&select=match_id,home,away`);
  if(!data?.length) return null;
  const obj = {};
  data.forEach(r => { obj[r.match_id] = {home:r.home,away:r.away}; });
  return obj;
};

const sSetScores = async (username, scores) => {
  const rows = Object.entries(scores)
    .filter(([,s]) => s.home!==""||s.away!=="")
    .map(([id,s]) => ({username,match_id:parseInt(id),home:s.home||"",away:s.away||""}));
  if(rows.length) await sbFetch("scores", "POST", rows);
};

const sSetScore = async (username, matchId, home, away) => {
  await sbFetch("scores", "POST", [{username,match_id:parseInt(matchId),home:home||"",away:away||""}]);
};

const sGetSpecials = async (username) => {
  const data = await sbFetch(`specials?username=eq.${encodeURIComponent(username)}&select=data`);
  return data?.[0]?.data || null;
};

const sSetSpecials = async (username, data) => {
  await sbFetch("specials", "POST", {username, data});
};

const sGetJokers = async (username) => {
  const data = await sbFetch(`jokers?username=eq.${encodeURIComponent(username)}&select=match_ids`);
  return data?.[0]?.match_ids || null;
};

const sSetJokers = async (username, matchIds) => {
  await sbFetch("jokers", "POST", {username, match_ids:matchIds});
};

const sGetFScores = async (username) => {
  const data = await sbFetch(`fscores?username=eq.${encodeURIComponent(username)}&select=match_id,home,away`);
  if(!data?.length) return null;
  const obj = {};
  data.forEach(r => { obj[r.match_id] = {home:r.home,away:r.away}; });
  return obj;
};

const sSetFScore = async (username, matchId, home, away) => {
  await sbFetch("fscores", "POST", [{username,match_id:String(matchId),home:home||"",away:away||""}]);
};

const sGetFJokers = async (username) => {
  const data = await sbFetch(`fjokers?username=eq.${encodeURIComponent(username)}&select=match_ids`);
  return data?.[0]?.match_ids || null;
};

const sSetFJokers = async (username, matchIds) => {
  await sbFetch("fjokers", "POST", {username, match_ids:matchIds.map(String)});
};

const sGetRealResults = async () => {
  const data = await sbFetch(`real_results?id=eq.singleton&select=scores,specials,knockout_results,reset_at`);
  const r = data?.[0];
  if(!r) return null;
  return {scores:r.scores||{},specials:r.specials||{},knockoutResults:r.knockout_results||{},resetAt:r.reset_at||null};
};

const sSetRealResults = async (scores, specials, knockoutResults) => {
  await sbFetch("real_results", "POST", {
    id:"singleton",
    scores: scores||{},
    specials: specials||{},
    knockout_results: knockoutResults||{}
  });
};

const sSetResetFlag = async () => {
  await sbFetch("real_results", "POST", {
    id:"singleton",
    scores:{}, specials:{}, knockout_results:{},
    reset_at: new Date().toISOString()
  });
};

const sGetAllUsers = async () => {
  const data = await sbFetch(`users?select=username&order=username`);
  return data?.map(r=>r.username) || [];
};

const sGetAllScores = async () => {
  const data = await sbFetch(`scores?select=username,match_id,home,away`);
  if(!data) return {};
  const result = {};
  data.forEach(r => {
    if(!result[r.username]) result[r.username] = {};
    result[r.username][r.match_id] = {home:r.home,away:r.away};
  });
  return result;
};

const sGetAllJokers = async () => {
  const data = await sbFetch(`jokers?select=username,match_ids`);
  if(!data) return {};
  const result = {};
  data.forEach(r => { result[r.username] = r.match_ids||[]; });
  return result;
};

const sGetAllFScores = async () => {
  const data = await sbFetch(`fscores?select=username,match_id,home,away`);
  if(!data) return {};
  const result = {};
  data.forEach(r => {
    if(!result[r.username]) result[r.username] = {};
    result[r.username][r.match_id] = {home:r.home,away:r.away};
  });
  return result;
};

const sGetAllFJokers = async () => {
  const data = await sbFetch(`fjokers?select=username,match_ids`);
  if(!data) return {};
  const result = {};
  data.forEach(r => { result[r.username] = r.match_ids||[]; });
  return result;
};

const sDeleteAll = async () => {
  // Save admin credentials before deleting
  const adminData = await sGetUser("admin").catch(()=>null);
  await Promise.all([
    sbFetch("scores?username=neq.impossible","DELETE"),
    sbFetch("specials?username=neq.impossible","DELETE"),
    sbFetch("jokers?username=neq.impossible","DELETE"),
    sbFetch("fscores?username=neq.impossible","DELETE"),
    sbFetch("fjokers?username=neq.impossible","DELETE"),
    sbFetch("real_results?id=eq.singleton","DELETE"),
    sbFetch("users?username=neq.impossible","DELETE"),
  ]);
  // Recreate admin user
  if(adminData) await sSetUser("admin", adminData.password, adminData.full_name||"Admin");
  // Set reset flag to force all users to logout
  await sSetResetFlag();
};

const sDeleteGameData = async () => {
  await Promise.all([
    sbFetch("scores?username=neq.impossible","DELETE"),
    sbFetch("specials?username=neq.impossible","DELETE"),
    sbFetch("jokers?username=neq.impossible","DELETE"),
    sbFetch("fscores?username=neq.impossible","DELETE"),
    sbFetch("fjokers?username=neq.impossible","DELETE"),
  ]);
  await sSetResetFlag();
};

const C = {
  bg:       "#070f07",
  surface:  "rgba(255,255,255,0.07)",
  border:   "rgba(255,255,255,0.12)",
  border2:  "rgba(255,255,255,0.2)",
  text:     "rgba(255,255,255,0.95)",
  muted:    "rgba(255,255,255,0.65)",
  faint:    "rgba(255,255,255,0.35)",
  gold:     "#f59e0b",
  goldL:    "#fcd34d",
  emerald:  "#34d399",
  rose:     "#fb7185",
  violet:   "#a78bfa",
  sky:      "#38bdf8",
  amber:    "#fbbf24",
};
const S = {
  card:    { background:C.surface, border:`1px solid ${C.border}`, borderRadius:"1rem", overflow:"hidden" },
  btn:     { border:"none", borderRadius:"0.75rem", fontWeight:900, cursor:"pointer", transition:"opacity 0.15s", fontFamily:"inherit" },
  input:   { background:"rgba(255,255,255,0.05)", border:`1px solid ${C.border}`, borderRadius:"0.75rem", padding:"0.625rem 0.75rem", color:"white", fontSize:"0.875rem", fontWeight:600, outline:"none", width:"100%", boxSizing:"border-box", fontFamily:"inherit" },
  label:   { display:"block", color:C.muted, fontSize:"0.6rem", fontWeight:900, textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:"0.375rem" },
  section: { marginBottom:"1.5rem" },
  hdr:     { display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.75rem" },
  badge:   { borderRadius:"0.625rem", width:"2rem", height:"2rem", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, fontSize:"0.75rem", flexShrink:0 },
  chevron: { width:"1rem", height:"1rem", transition:"transform 0.25s", flexShrink:0 },
  accordion: (open) => ({ background: open ? "rgba(255,255,255,0.07)" : C.surface, border:`1px solid ${open ? C.border2 : C.border}`, borderRadius:"1rem", cursor:"pointer", width:"100%", textAlign:"left", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.75rem", transition:"background 0.2s" }),
};

// --- TEAMS --------------------------------------------------------------------
const T = {
  mex:{flag:"🇲🇽",short:"MEX",name:"México",group:"A",host:true,iso:"mx"},
  rsa:{flag:"🇿🇦",short:"RSA",name:"Sudáfrica",group:"A",iso:"za"},
  kor:{flag:"🇰🇷",short:"KOR",name:"Corea del Sur",group:"A",iso:"kr"},
  cze:{flag:"🇨🇿",short:"CZE",name:"Rep. Checa",group:"A",iso:"cz"},
  can:{flag:"🇨🇦",short:"CAN",name:"Canadá",group:"B",host:true,iso:"ca"},
  bih:{flag:"🇧🇦",short:"BIH",name:"Bosnia-Herz.",group:"B",iso:"ba"},
  qat:{flag:"🇶🇦",short:"QAT",name:"Qatar",group:"B",iso:"qa"},
  sui:{flag:"🇨🇭",short:"SUI",name:"Suiza",group:"B",iso:"ch"},
  bra:{flag:"🇧🇷",short:"BRA",name:"Brasil",group:"C",iso:"br"},
  mar:{flag:"🇲🇦",short:"MAR",name:"Marruecos",group:"C",iso:"ma"},
  hai:{flag:"🇭🇹",short:"HAI",name:"Haití",group:"C",iso:"ht"},
  sco:{flag:"🏴",short:"SCO",name:"Escocia",group:"C",iso:"gb-sct"},
  usa:{flag:"🇺🇸",short:"USA",name:"Estados Unidos",group:"D",host:true,iso:"us"},
  par:{flag:"🇵🇾",short:"PAR",name:"Paraguay",group:"D",iso:"py"},
  aus:{flag:"🇦🇺",short:"AUS",name:"Australia",group:"D",iso:"au"},
  tur:{flag:"🇹🇷",short:"TUR",name:"Türkiye",group:"D",iso:"tr"},
  ger:{flag:"🇩🇪",short:"GER",name:"Alemania",group:"E",iso:"de"},
  cur:{flag:"🇨🇼",short:"CUR",name:"Curazao",group:"E",iso:"cw"},
  civ:{flag:"🇨🇮",short:"CIV",name:"C. de Marfil",group:"E",iso:"ci"},
  ecu:{flag:"🇪🇨",short:"ECU",name:"Ecuador",group:"E",iso:"ec"},
  ned:{flag:"🇳🇱",short:"NED",name:"Países Bajos",group:"F",iso:"nl"},
  jpn:{flag:"🇯🇵",short:"JPN",name:"Japón",group:"F",iso:"jp"},
  swe:{flag:"🇸🇪",short:"SWE",name:"Suecia",group:"F",iso:"se"},
  tun:{flag:"🇹🇳",short:"TUN",name:"Túnez",group:"F",iso:"tn"},
  bel:{flag:"🇧🇪",short:"BEL",name:"Bélgica",group:"G",iso:"be"},
  egy:{flag:"🇪🇬",short:"EGY",name:"Egipto",group:"G",iso:"eg"},
  iri:{flag:"🇮🇷",short:"IRI",name:"Irán",group:"G",iso:"ir"},
  nzl:{flag:"🇳🇿",short:"NZL",name:"Nueva Zelanda",group:"G",iso:"nz"},
  esp:{flag:"🇪🇸",short:"ESP",name:"España",group:"H",iso:"es"},
  cpv:{flag:"🇨🇻",short:"CPV",name:"Cabo Verde",group:"H",iso:"cv"},
  ksa:{flag:"🇸🇦",short:"KSA",name:"Arabia Saudita",group:"H",iso:"sa"},
  uru:{flag:"🇺🇾",short:"URU",name:"Uruguay",group:"H",iso:"uy"},
  fra:{flag:"🇫🇷",short:"FRA",name:"Francia",group:"I",iso:"fr"},
  sen:{flag:"🇸🇳",short:"SEN",name:"Senegal",group:"I",iso:"sn"},
  irq:{flag:"🇮🇶",short:"IRQ",name:"Irak",group:"I",iso:"iq"},
  nor:{flag:"🇳🇴",short:"NOR",name:"Noruega",group:"I",iso:"no"},
  arg:{flag:"🇦🇷",short:"ARG",name:"Argentina",group:"J",iso:"ar"},
  alg:{flag:"🇩🇿",short:"ALG",name:"Argelia",group:"J",iso:"dz"},
  aut:{flag:"🇦🇹",short:"AUT",name:"Austria",group:"J",iso:"at"},
  jor:{flag:"🇯🇴",short:"JOR",name:"Jordania",group:"J",iso:"jo"},
  por:{flag:"🇵🇹",short:"POR",name:"Portugal",group:"K",iso:"pt"},
  uzb:{flag:"🇺🇿",short:"UZB",name:"Uzbekistán",group:"K",iso:"uz"},
  col:{flag:"🇨🇴",short:"COL",name:"Colombia",group:"K",iso:"co"},
  cod:{flag:"🇨🇩",short:"COD",name:"R.D. Congo",group:"K",iso:"cd"},
  eng:{flag:"🏴",short:"ENG",name:"Inglaterra",group:"L",iso:"gb-eng"},
  cro:{flag:"🇭🇷",short:"CRO",name:"Croacia",group:"L",iso:"hr"},
  pan:{flag:"🇵🇦",short:"PAN",name:"Panamá",group:"L",iso:"pa"},
  gha:{flag:"🇬🇭",short:"GHA",name:"Ghana",group:"L",iso:"gh"},
};
const TEAMS_LIST = Object.entries(T).map(([id,t])=>({id,...t})).sort((a,b)=>a.name.localeCompare(b.name,"es"));
const GROUPS = {
  A:["mex","rsa","kor","cze"],B:["can","bih","qat","sui"],
  C:["bra","mar","hai","sco"],D:["usa","par","aus","tur"],
  E:["ger","cur","civ","ecu"],F:["ned","jpn","swe","tun"],
  G:["bel","egy","iri","nzl"],H:["esp","cpv","ksa","uru"],
  I:["fra","sen","irq","nor"],J:["arg","alg","aut","jor"],
  K:["por","uzb","col","cod"],L:["eng","cro","pan","gha"],
};

// --- FIXTURES -----------------------------------------------------------------
const FECHAS = [
  {id:1,label:"Fecha 1",sub:"Miércoles 14 de Mayo, 2026",matches:[
    {id:1001,home:"mex",away:"rsa",time:"08:00",venue:"Estadio Azteca",group:"A"},
    {id:1002,home:"kor",away:"cze",time:"09:00",venue:"Estadio Akron",group:"A"},
  ]},
  {id:2,label:"Fecha 2",sub:"Miércoles 14 de Mayo, 2026",matches:[
    {id:1003,home:"can",away:"bih",time:"10:00",venue:"BMO Field",group:"B"},
    {id:1004,home:"usa",away:"par",time:"11:00",venue:"SoFi Stadium",group:"D"},
  ]},
  {id:3,label:"Fecha 3",sub:"Miércoles 14 de Mayo, 2026",matches:[
    {id:1005,home:"qat",away:"sui",time:"12:00",venue:"Levi's Stadium",group:"B"},
    {id:1006,home:"bra",away:"mar",time:"13:00",venue:"MetLife Stadium",group:"C"},
    {id:1007,home:"hai",away:"sco",time:"14:00",venue:"Gillette Stadium",group:"C"},
  ]},
  {id:4,label:"Fecha 4",sub:"Miércoles 14 de Mayo, 2026",matches:[
    {id:1008,home:"aus",away:"tur",time:"15:00",venue:"BC Place",group:"D"},
    {id:1009,home:"ger",away:"cur",time:"16:00",venue:"NRG Stadium",group:"E"},
    {id:1010,home:"civ",away:"ecu",time:"17:00",venue:"Lincoln Financial Field",group:"E"},
    {id:1011,home:"ned",away:"jpn",time:"18:00",venue:"AT&T Stadium",group:"F"},
    {id:1012,home:"swe",away:"tun",time:"19:00",venue:"Estadio BBVA",group:"F"},
  ]},
  {id:5,label:"Fecha 5",sub:"Jueves 15 de Mayo, 2026",matches:[
    {id:1013,home:"bel",away:"egy",time:"20:00",venue:"Lumen Field",group:"G"},
    {id:1014,home:"iri",away:"nzl",time:"21:00",venue:"SoFi Stadium",group:"G"},
    {id:1015,home:"esp",away:"cpv",time:"22:00",venue:"Mercedes-Benz Stadium",group:"H"},
    {id:1016,home:"ksa",away:"uru",time:"08:00",venue:"Hard Rock Stadium",group:"H"},
  ]},
  {id:6,label:"Fecha 6",sub:"Jueves 15 de Mayo, 2026",matches:[
    {id:1017,home:"fra",away:"sen",time:"09:00",venue:"MetLife Stadium",group:"I"},
    {id:1018,home:"irq",away:"nor",time:"10:00",venue:"Gillette Stadium",group:"I"},
    {id:1019,home:"arg",away:"alg",time:"11:00",venue:"Arrowhead Stadium",group:"J"},
  ]},
  {id:7,label:"Fecha 7",sub:"Jueves 15 de Mayo, 2026",matches:[
    {id:1020,home:"aut",away:"jor",time:"12:00",venue:"Levi's Stadium",group:"J"},
    {id:1021,home:"por",away:"cod",time:"13:00",venue:"NRG Stadium",group:"K"},
    {id:1022,home:"uzb",away:"col",time:"14:00",venue:"Estadio Azteca",group:"K"},
    {id:1023,home:"eng",away:"cro",time:"15:00",venue:"AT&T Stadium",group:"L"},
    {id:1024,home:"gha",away:"pan",time:"16:00",venue:"BMO Field",group:"L"},
  ]},
  {id:8,label:"Fecha 8",sub:"Jueves 15 de Mayo, 2026",matches:[
    {id:1025,home:"cze",away:"rsa",time:"17:00",venue:"Mercedes-Benz Stadium",group:"A"},
    {id:1026,home:"mex",away:"kor",time:"18:00",venue:"Estadio Akron",group:"A"},
    {id:1027,home:"sui",away:"bih",time:"19:00",venue:"SoFi Stadium",group:"B"},
    {id:1028,home:"can",away:"qat",time:"20:00",venue:"BC Place",group:"B"},
  ]},
  {id:9,label:"Fecha 9",sub:"Viernes 16 de Mayo, 2026",matches:[
    {id:1029,home:"sco",away:"mar",time:"21:00",venue:"Gillette Stadium",group:"C"},
    {id:1030,home:"bra",away:"hai",time:"22:00",venue:"Lincoln Financial Field",group:"C"},
    {id:1031,home:"usa",away:"aus",time:"08:00",venue:"Lumen Field",group:"D"},
  ]},
  {id:10,label:"Fecha 10",sub:"Viernes 16 de Mayo, 2026",matches:[
    {id:1032,home:"tur",away:"par",time:"09:00",venue:"Levi's Stadium",group:"D"},
    {id:1033,home:"ger",away:"civ",time:"10:00",venue:"BMO Field",group:"E"},
    {id:1034,home:"ecu",away:"cur",time:"11:00",venue:"Arrowhead Stadium",group:"E"},
    {id:1035,home:"ned",away:"swe",time:"12:00",venue:"NRG Stadium",group:"F"},
  ]},
  {id:11,label:"Fecha 11",sub:"Viernes 16 de Mayo, 2026",matches:[
    {id:1036,home:"tun",away:"jpn",time:"13:00",venue:"Estadio BBVA",group:"F"},
    {id:1037,home:"bel",away:"iri",time:"14:00",venue:"SoFi Stadium",group:"G"},
    {id:1038,home:"nzl",away:"egy",time:"15:00",venue:"BC Place",group:"G"},
    {id:1039,home:"esp",away:"ksa",time:"16:00",venue:"Mercedes-Benz Stadium",group:"H"},
    {id:1040,home:"uru",away:"cpv",time:"17:00",venue:"Hard Rock Stadium",group:"H"},
  ]},
  {id:12,label:"Fecha 12",sub:"Viernes 16 de Mayo, 2026",matches:[
    {id:1041,home:"arg",away:"aut",time:"18:00",venue:"AT&T Stadium",group:"J"},
    {id:1042,home:"fra",away:"irq",time:"19:00",venue:"Lincoln Financial Field",group:"I"},
    {id:1043,home:"nor",away:"sen",time:"20:00",venue:"MetLife Stadium",group:"I"},
    {id:1044,home:"jor",away:"alg",time:"21:00",venue:"Levi's Stadium",group:"J"},
  ]},
  {id:13,label:"Fecha 13",sub:"Sábado 17 de Mayo, 2026",matches:[
    {id:1045,home:"por",away:"uzb",time:"22:00",venue:"NRG Stadium",group:"K"},
    {id:1046,home:"eng",away:"gha",time:"08:00",venue:"Gillette Stadium",group:"L"},
    {id:1047,home:"pan",away:"cro",time:"09:00",venue:"BMO Field",group:"L"},
    {id:1048,home:"col",away:"cod",time:"10:00",venue:"Estadio Akron",group:"K"},
  ]},
  {id:14,label:"Fecha 14",sub:"Sábado 17 de Mayo, 2026",matches:[
    {id:1049,home:"sui",away:"can",time:"11:00",venue:"BC Place",group:"B"},
    {id:1050,home:"bih",away:"qat",time:"12:00",venue:"Lumen Field",group:"B"},
    {id:1051,home:"sco",away:"bra",time:"13:00",venue:"Hard Rock Stadium",group:"C"},
    {id:1052,home:"mar",away:"hai",time:"14:00",venue:"Mercedes-Benz Stadium",group:"C"},
    {id:1053,home:"cze",away:"mex",time:"15:00",venue:"Estadio Azteca",group:"A"},
    {id:1054,home:"rsa",away:"kor",time:"16:00",venue:"Estadio BBVA",group:"A"},
  ]},
  {id:15,label:"Fecha 15",sub:"Sábado 17 de Mayo, 2026",matches:[
    {id:1055,home:"ger",away:"ecu",time:"17:00",venue:"MetLife Stadium",group:"E"},
    {id:1056,home:"cur",away:"civ",time:"18:00",venue:"Lincoln Financial Field",group:"E"},
    {id:1057,home:"jpn",away:"swe",time:"19:00",venue:"AT&T Stadium",group:"F"},
    {id:1058,home:"tun",away:"ned",time:"20:00",venue:"Arrowhead Stadium",group:"F"},
    {id:1059,home:"tur",away:"usa",time:"21:00",venue:"SoFi Stadium",group:"D"},
    {id:1060,home:"par",away:"aus",time:"22:00",venue:"Levi's Stadium",group:"D"},
  ]},
  {id:16,label:"Fecha 16",sub:"Sábado 17 de Mayo, 2026",matches:[
    {id:1061,home:"nor",away:"fra",time:"08:00",venue:"Gillette Stadium",group:"I"},
    {id:1062,home:"sen",away:"irq",time:"09:00",venue:"BMO Field",group:"I"},
    {id:1063,home:"uru",away:"esp",time:"10:00",venue:"Estadio Akron",group:"H"},
    {id:1064,home:"cpv",away:"ksa",time:"11:00",venue:"NRG Stadium",group:"H"},
    {id:1065,home:"bel",away:"nzl",time:"12:00",venue:"BC Place",group:"G"},
    {id:1066,home:"egy",away:"iri",time:"13:00",venue:"Lumen Field",group:"G"},
  ]},
  {id:17,label:"Fecha 17",sub:"Sábado 17 de Mayo, 2026",matches:[
    {id:1067,home:"pan",away:"eng",time:"14:00",venue:"MetLife Stadium",group:"L"},
    {id:1068,home:"cro",away:"gha",time:"15:00",venue:"Lincoln Financial Field",group:"L"},
    {id:1069,home:"col",away:"por",time:"16:00",venue:"Hard Rock Stadium",group:"K"},
    {id:1070,home:"cod",away:"uzb",time:"17:00",venue:"Mercedes-Benz Stadium",group:"K"},
    {id:1071,home:"jor",away:"arg",time:"18:00",venue:"AT&T Stadium",group:"J"},
    {id:1072,home:"alg",away:"aut",time:"19:00",venue:"Arrowhead Stadium",group:"J"},
  ]},
];
const ALL_MATCHES = FECHAS.flatMap(f=>f.matches);
const emptyScores = () => Object.fromEntries(ALL_MATCHES.map(m=>[m.id,{home:"",away:""}]));
const PAGE_SIZE = 3;

// --- LOCK ---------------------------------------------------------------------
const KICKOFF_UTC={1001:Date.UTC(2026,4,14,12,0),1002:Date.UTC(2026,4,14,13,0),1003:Date.UTC(2026,4,14,14,0),1004:Date.UTC(2026,4,14,15,0),1005:Date.UTC(2026,4,14,16,0),1006:Date.UTC(2026,4,14,17,0),1007:Date.UTC(2026,4,14,18,0),1008:Date.UTC(2026,4,14,19,0),1009:Date.UTC(2026,4,14,20,0),1010:Date.UTC(2026,4,14,21,0),1011:Date.UTC(2026,4,14,22,0),1012:Date.UTC(2026,4,14,23,0),1013:Date.UTC(2026,4,15,0,0),1014:Date.UTC(2026,4,15,1,0),1015:Date.UTC(2026,4,15,2,0),1016:Date.UTC(2026,4,15,12,0),1017:Date.UTC(2026,4,15,13,0),1018:Date.UTC(2026,4,15,14,0),1019:Date.UTC(2026,4,15,15,0),1020:Date.UTC(2026,4,15,16,0),1021:Date.UTC(2026,4,15,17,0),1022:Date.UTC(2026,4,15,18,0),1023:Date.UTC(2026,4,15,19,0),1024:Date.UTC(2026,4,15,20,0),1025:Date.UTC(2026,4,15,21,0),1026:Date.UTC(2026,4,15,22,0),1027:Date.UTC(2026,4,15,23,0),1028:Date.UTC(2026,4,16,0,0),1029:Date.UTC(2026,4,16,1,0),1030:Date.UTC(2026,4,16,2,0),1031:Date.UTC(2026,4,16,12,0),1032:Date.UTC(2026,4,16,13,0),1033:Date.UTC(2026,4,16,14,0),1034:Date.UTC(2026,4,16,15,0),1035:Date.UTC(2026,4,16,16,0),1036:Date.UTC(2026,4,16,17,0),1037:Date.UTC(2026,4,16,18,0),1038:Date.UTC(2026,4,16,19,0),1039:Date.UTC(2026,4,16,20,0),1040:Date.UTC(2026,4,16,21,0),1041:Date.UTC(2026,4,16,22,0),1042:Date.UTC(2026,4,16,23,0),1043:Date.UTC(2026,4,17,0,0),1044:Date.UTC(2026,4,17,1,0),1045:Date.UTC(2026,4,17,2,0),1046:Date.UTC(2026,4,17,12,0),1047:Date.UTC(2026,4,17,13,0),1048:Date.UTC(2026,4,17,14,0),1049:Date.UTC(2026,4,17,15,0),1050:Date.UTC(2026,4,17,16,0),1051:Date.UTC(2026,4,17,17,0),1052:Date.UTC(2026,4,17,18,0),1053:Date.UTC(2026,4,17,19,0),1054:Date.UTC(2026,4,17,20,0),1055:Date.UTC(2026,4,17,21,0),1056:Date.UTC(2026,4,17,22,0),1057:Date.UTC(2026,4,17,23,0),1058:Date.UTC(2026,4,18,0,0),1059:Date.UTC(2026,4,18,1,0),1060:Date.UTC(2026,4,18,2,0),1061:Date.UTC(2026,4,18,12,0),1062:Date.UTC(2026,4,18,13,0),1063:Date.UTC(2026,4,18,14,0),1064:Date.UTC(2026,4,18,15,0),1065:Date.UTC(2026,4,18,16,0),1066:Date.UTC(2026,4,18,17,0),1067:Date.UTC(2026,4,18,18,0),1068:Date.UTC(2026,4,18,19,0),1069:Date.UTC(2026,4,18,20,0),1070:Date.UTC(2026,4,18,21,0),1071:Date.UTC(2026,4,18,22,0),1072:Date.UTC(2026,4,18,23,0)};
const KO_KICKOFF={"r32_1":Date.UTC(2026,4,19,0,0),"r32_2":Date.UTC(2026,4,19,1,0),"r32_3":Date.UTC(2026,4,19,2,0),"r32_4":Date.UTC(2026,4,19,12,0),"r32_5":Date.UTC(2026,4,19,13,0),"r32_6":Date.UTC(2026,4,19,14,0),"r32_7":Date.UTC(2026,4,19,15,0),"r32_8":Date.UTC(2026,4,19,16,0),"r32_9":Date.UTC(2026,4,19,17,0),"r32_10":Date.UTC(2026,4,19,18,0),"r32_11":Date.UTC(2026,4,19,19,0),"r32_12":Date.UTC(2026,4,19,20,0),"r32_13":Date.UTC(2026,4,19,21,0),"r32_14":Date.UTC(2026,4,19,22,0),"r32_15":Date.UTC(2026,4,19,23,0),"r32_16":Date.UTC(2026,4,20,0,0),"r16_1":Date.UTC(2026,4,20,1,0),"r16_2":Date.UTC(2026,4,20,2,0),"r16_3":Date.UTC(2026,4,20,12,0),"r16_4":Date.UTC(2026,4,20,13,0),"r16_5":Date.UTC(2026,4,20,14,0),"r16_6":Date.UTC(2026,4,20,15,0),"r16_7":Date.UTC(2026,4,20,16,0),"r16_8":Date.UTC(2026,4,20,17,0),"qf_1":Date.UTC(2026,4,20,18,0),"qf_2":Date.UTC(2026,4,20,19,0),"qf_3":Date.UTC(2026,4,20,20,0),"qf_4":Date.UTC(2026,4,20,21,0),"sf_1":Date.UTC(2026,4,20,22,0),"sf_2":Date.UTC(2026,4,20,23,0),"third_1":Date.UTC(2026,4,21,0,0),"final_1":Date.UTC(2026,4,21,1,0)};
const isLocked = id => { const k=KICKOFF_UTC[id]||KO_KICKOFF[id]; return k?Date.now()>=k-10*60*1000:false; };
const SPECIALS_DEADLINE = Date.UTC(2026,4,15,21,50); // 10 min antes de México vs Corea (id 1026)
const DESIGNATED_DEADLINE = Date.UTC(2026,4,14,11,50); // 10 min antes del 1er partido (id 1001)
const isDesignatedLocked = () => Date.now() >= DESIGNATED_DEADLINE;
const isSpecialsLocked = () => Date.now() >= SPECIALS_DEADLINE;

// --- SCORING ------------------------------------------------------------------
const PTS_CAMPEON=10,PTS_SUBCAMPEON=7,PTS_GOLEADOR=10,PTS_CLASIFICADO=1,PTS_TERCERO=2;

function matchPts(pred,real) {
  const ph=parseInt(pred?.home),pa=parseInt(pred?.away),rh=parseInt(real?.home),ra=parseInt(real?.away);
  if([ph,pa,rh,ra].some(isNaN)) return 0;
  let p=0;
  if(ph===rh&&pa===ra) p+=3;
  if((rh>ra?"H":rh<ra?"A":"D")===(ph>pa?"H":ph<pa?"A":"D")) p+=3;
  if(ph===rh) p+=1;
  if(pa===ra) p+=1;
  return p;
}

function calcPoints(sc,sp,rr,jk=[]) {
  if(!rr) return {total:0,partidos:0,especiales:0,breakdown:{}};
  let partidos=0,especiales=0;
  const bd={campeon:0,subcampeon:0,goleador:0,goleadorDesignado:0,arqueroDesignado:0,clasificados:0,goleadorDesignadoName:"",arqueroDesignadoName:""};
  try {
    ALL_MATCHES.forEach(m=>{
      const real=rr[m.id]; if(!real) return;
      let p=matchPts(sc?.[m.id],real);
      if(jk.includes(m.id)) p*=2;
      partidos+=p;
    });
    if(sp?.campeon&&rr.campeon&&sp.campeon===rr.campeon){bd.campeon=PTS_CAMPEON;especiales+=PTS_CAMPEON;}
    if(sp?.subcampeon&&rr.subcampeon&&sp.subcampeon===rr.subcampeon){bd.subcampeon=PTS_SUBCAMPEON;especiales+=PTS_SUBCAMPEON;}
    const sg=String(sp?.goleador||"").trim().toLowerCase(),rg=String(rr.goleador||"").trim().toLowerCase();
    if(sg&&rg&&sg===rg){bd.goleador=PTS_GOLEADOR;especiales+=PTS_GOLEADOR;}
    const sgd=String(sp?.goleadorDesignado||"").trim().toLowerCase();
    if(sgd){
      const gdMap=rr.goleadoresDesignados||{};
      const gdGoals=parseInt(Object.entries(gdMap).find(([k])=>k.trim().toLowerCase()===sgd)?.[1])||0;
      bd.goleadorDesignado=gdGoals;bd.goleadorDesignadoName=sp.goleadorDesignado;especiales+=gdGoals;
    }
    const saq=String(sp?.arqueroDesignado||"").trim().toLowerCase();
    if(saq){
      const aqMap=rr.arquerosDesignados||{};
      const aqCS=parseInt(Object.entries(aqMap).find(([k])=>k.trim().toLowerCase()===saq)?.[1])||0;
      bd.arqueroDesignado=aqCS;bd.arqueroDesignadoName=sp.arqueroDesignado;especiales+=aqCS;
    }
    const uG=sp?.clasificados?.grupos||{},rG=rr.clasificados?.grupos||{};
    Object.keys(GROUPS).forEach(gid=>{
      const uArr=uG[gid]||[],rArr=rG[gid]||[];
      uArr.slice(0,2).forEach(id=>{ if(rArr.includes(id)){bd.clasificados+=PTS_CLASIFICADO;especiales+=PTS_CLASIFICADO;} });
      if(uArr[2]&&rArr.includes(uArr[2])){bd.clasificados+=PTS_TERCERO;especiales+=PTS_TERCERO;}
    });
  } catch(_){}
  return {total:partidos+especiales,partidos,especiales,breakdown:bd};
}

function computeTable(gid,sc) {
  const ids=GROUPS[gid],st=Object.fromEntries(ids.map(id=>[id,{pts:0,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0}]));
  ALL_MATCHES.filter(m=>m.group===gid).forEach(m=>{
    const s=sc[m.id],h=parseInt(s?.home),a=parseInt(s?.away); if(isNaN(h)||isNaN(a)) return;
    st[m.home].pj++;st[m.away].pj++;st[m.home].gf+=h;st[m.home].gc+=a;st[m.away].gf+=a;st[m.away].gc+=h;
    st[m.home].dg+=h-a;st[m.away].dg+=a-h;
    if(h>a){st[m.home].pts+=3;st[m.home].pg++;st[m.away].pp++;}
    else if(h<a){st[m.away].pts+=3;st[m.away].pg++;st[m.home].pp++;}
    else{st[m.home].pts++;st[m.away].pts++;st[m.home].pe++;st[m.away].pe++;}
  });
  return ids.map(id=>({...T[id],id,...st[id]})).sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf);
}

// --- GROUP BADGE COLORS -------------------------------------------------------

// Flag image component using flagcdn.com
function FlagImg({team, size=24}) {
  if(!team?.iso) return <span style={{fontSize:"1.5rem",lineHeight:1}}>{team?.flag||"🏳"}</span>;
  const h = Math.round(size*0.75);
  return (
    <img
      src={`https://flagcdn.com/${size}x${h}/${team.iso}.png`}
      srcSet={`https://flagcdn.com/${size*2}x${h*2}/${team.iso}.png 2x`}
      width={size} height={h}
      alt={team?.short||""}
      style={{borderRadius:"2px",objectFit:"cover",display:"inline-block"}}
      onError={e=>{e.target.style.display="none";e.target.nextSibling&&(e.target.nextSibling.style.display="inline");}}
    />
  );
}

// --- PUSH NOTIFICATIONS -------------------------------------------------------
const VAPID_PUBLIC_KEY = "BHqtPP5vvCtb4hp9Lm0keOdS4M0VHBfbkVQ-RBcR6IiSV1MCP7qETNc8a3fQUxJtvgI0jTlykk0Xg7pweHIlvr4";

const urlB64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
};

const registerPush = async () => {
  try {
    if(!('serviceWorker' in navigator)){alert("Tu navegador no soporta notificaciones push.");return false;}
    if(!('PushManager' in window)){alert("Tu navegador no soporta notificaciones push.");return false;}
    // Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    // Request permission
    const permission = await Notification.requestPermission();
    if(permission !== 'granted'){alert("Permiso denegado. Habilitá las notificaciones en tu navegador.");return false;}
    // Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    // Save to Supabase
    await sbFetch("push_subscriptions", "POST", {subscription: sub.toJSON()});
    return true;
  } catch(e) {
    console.error("Push error:", e);
    alert("Error al activar notificaciones: " + e.message);
    return false;
  }
};

const GCOLORS = ["#f59e0b","#38bdf8","#a78bfa","#34d399","#fb7185","#f97316","#22d3ee","#f472b6","#a3e635","#818cf8","#2dd4bf","#e879f9"];
const FBADGES = [...GCOLORS,...GCOLORS];

// --- PLAYERS BY TEAM ---------------------------------------------------------
const PLAYERS = {
  mex:["Guillermo Ochoa","Santiago Giménez","Hirving Lozano","Edson Álvarez","Raúl Jiménez","Henry Martín","Roberto Alvarado","Alexis Vega"],
  rsa:["Ronwen Williams","Percy Tau","Themba Zwane","Evidence Makgopa","Bongokuhle Hlongwane","Lyle Foster","Mamelodi Sundowns XI","Teboho Mokoena"],
  kor:["Kim Min-jae","Son Heung-min","Lee Kang-in","Hwang Hee-chan","Hwang In-beom","Jo Hyeon-woo","Oh Hyeon-gyu","Cho Gue-sung"],
  cze:["Jakub Jankto","Patrik Schick","Tomáš Souček","Vladimír Coufal","Matěj Kovář","Adam Hložek","Lukáš Provod","Antonín Barák"],
  can:["Alphonso Davies","Jonathan David","Cyle Larin","Tajon Buchanan","Stephen Eustáquio","Milan Borjan","Liam Millar","Atiba Hutchinson"],
  bih:["Edin Džeko","Miralem Pjanić","Sanjin Prcić","Amer Gojak","Ermedin Demirović","Nikola Vlašić","Senijad Ibričić","Damir Džidić"],
  qat:["Akram Afif","Almoez Ali","Hassan Al-Haydos","Meshaal Barsham","Boualem Khoukhi","Assim Madibo","Pedro Miguel","Salem Al-Hajri"],
  sui:["Granit Xhaka","Xherdan Shaqiri","Breel Embolo","Yann Sommer","Manuel Akanji","Fabian Schär","Ruben Vargas","Noah Okafor"],
  bra:["Vinícius Jr.","Rodrygo","Raphinha","Alisson Becker","Casemiro","Marquinhos","Gabriel Martinelli","Endrick"],
  mar:["Achraf Hakimi","Hakim Ziyech","Yassine Bounou","Sofyan Amrabat","Youssef En-Nesyri","Romain Saïss","Azzedine Ounahi","Abdessamad Ezzalzouli"],
  hai:["Frantzdy Pierrot","Duckens Nazon","Mechack Jérôme","Steeven Saba","Karl Noel","Wilde-Donald Guerrier","Orlain Fignolé","Lionel Saint-Preux"],
  sco:["Andy Robertson","Scott McTominay","Kieran Tierney","John McGinn","Che Adams","Lyndon Dykes","Craig Gordon","Ryan Christie"],
  usa:["Christian Pulisic","Tyler Adams","Weston McKennie","Gio Reyna","Matt Turner","Tim Weah","Yunus Musah","Ricardo Pepi"],
  par:["Miguel Almirón","Gustavo Gómez","Óscar Romero","Robert Morales","Mathías Villasanti","Diego Gómez","Antony Silva","Julio Enciso"],
  aus:["Mat Ryan","Mathew Leckie","Aaron Mooy","Tom Rogic","Martin Boyle","Ajdin Hrustic","Mitch Duke","Craig Goodwin"],
  tur:["Hakan Çalhanoğlu","Arda Güler","Kerem Aktürkoğlu","Mert Müldür","Merih Demiral","Altay Bayındır","Yunus Akgün","Barış Alper Yılmaz"],
  ger:["Manuel Neuer","Joshua Kimmich","Toni Kroos","Florian Wirtz","Jamal Musiala","Kai Havertz","Leroy Sané","Thomas Müller"],
  cur:["Cuco Martina","Leandro Bacuna","Genero Snijders","Gevaro Nepomuceno","Quentin Met","Brandley Kuwas","Elson Hooi","Rangelo Janga"],
  civ:["Sébastien Haller","Serge Aurier","Franck Kessié","Nicolas Pépé","Wilfried Zaha","Amadou Diallo","Eric Bailly","Gradel Max"],
  ecu:["Enner Valencia","Moisés Caicedo","Ángel Mena","Piero Hincapié","Jeremy Sarmiento","Gonzalo Plata","Byron Castillo","Alexander Domínguez"],
  ned:["Virgil van Dijk","Memphis Depay","Frenkie de Jong","Cody Gakpo","Xavi Simons","Daley Blind","Denzel Dumfries","Ryan Gravenberch"],
  jpn:["Takumi Minamino","Hiroki Sakai","Maya Yoshida","Daichi Kamada","Ritsu Doan","Takehiro Tomiyasu","Shuichi Gonda","Junya Ito"],
  swe:["Zlatan Ibrahimović","Alexander Isak","Dejan Kulusevski","Robin Quaison","Emil Krafth","Viktor Claesson","Robin Olsen","Mattias Svanberg"],
  tun:["Wahbi Khazri","Youssef Msakni","Ali Maaloul","Hannibal Mejbri","Aïssa Laïdouni","Montassar Talbi","Bechir Ben Saïd","Dylan Bronn"],
  bel:["Kevin De Bruyne","Romelu Lukaku","Thibaut Courtois","Jan Vertonghen","Axel Witsel","Yannick Carrasco","Dries Mertens","Eden Hazard"],
  egy:["Mohamed Salah","Mohamed El-Shenawy","Ahmed Hegazy","Trezeguet","Omar Marmoush","Mostafa Mohamed","Amr El-Sulaya","Zizo"],
  iri:["Mehdi Taremi","Alireza Beiranvand","Sardar Azmoun","Saman Ghoddos","Karim Ansarifard","Milad Mohammadi","Ali Gholizadeh","Roozbeh Cheshmi"],
  nzl:["Winston Reid","Chris Wood","Bill Tuilagi","Liberato Cacace","Callum McCowatt","Sarpreet Singh","Stefan Marinovic","Joe Bell"],
  esp:["Unai Simón","Dani Olmo","Pedri","Gavi","Lamine Yamal","Ferran Torres","Álvaro Morata","Rodri"],
  cpv:["Ryan Mendes","Garry Rodrigues","Julio Tavares","Dylan Tavares","Stopira","Kenny Rocha","Marco Soares","Willy Semedo"],
  ksa:["Mohammed Al-Owais","Salem Al-Dawsari","Firas Al-Buraikan","Mohammed Kanno","Sami Al-Najei","Abdullah Al-Hamdan","Haitham Asiri","Ali Al-Bulaihi"],
  uru:["Luis Suárez","Diego Godín","Federico Valverde","Darwin Núñez","Rodrigo Bentancur","José María Giménez","Sebastián Coates","Ronald Araújo"],
  fra:["Kylian Mbappé","Karim Benzema","Antoine Griezmann","Hugo Lloris","Raphaël Varane","N'Golo Kanté","Paul Pogba","Ousmane Dembélé"],
  sen:["Sadio Mané","Édouard Mendy","Kalidou Koulibaly","Idrissa Gueye","Ismaïla Sarr","Bamba Dieng","Habib Diallo","Nampalys Mendy"],
  irq:["Ali Adnan","Amjad Attwan","Aymen Hussein","Mohanad Ali","Justin Meram","Ahmed Yasin","Bassim Abbas","Safaa Hadi"],
  nor:["Erling Haaland","Martin Ødegaard","Alexander Sørloth","Ørjan Nyland","Stefan Strandberg","Mohamed Elyounoussi","Kristoffer Ajer","Sander Berge"],
  arg:["Lionel Messi","Lautaro Martínez","Emiliano Martínez","Nicolás Otamendi","Rodrigo De Paul","Ángel Di María","Paulo Dybala","Julián Álvarez"],
  alg:["Riyad Mahrez","Islam Slimani","Youcef Atal","Djamel Benlamri","Ismael Bennacer","Haris Belkebla","Aissa Mandi","Baghdad Bounedjah"],
  aut:["David Alaba","Marko Arnautović","Marcel Sabitzer","Stefan Posch","Florian Grillitsch","Nicolas Seiwald","Patrick Wimmer","Aleksandar Dragović"],
  jor:["Baha' Faisal","Mohammad Abu Zema","Musa Al-Taamari","Yazan Al-Arab","Nizar Al-Momani","Anas Bani Yaseen","Mahmoud Shelbaieh","Ahmad Daraghmeh"],
  por:["Cristiano Ronaldo","Bruno Fernandes","Bernardo Silva","Rúben Dias","João Cancelo","Diogo Dalot","Rafael Leão","João Félix"],
  uzb:["Eldor Shomurodov","Dostonbek Khamdamov","Bobur Abdixoliqov","Shamsiddin Tillayev","Khurshid Tursunov","Jaloliddin Masharipov","Otabek Shukurov","Jasur Yakhshiboev"],
  col:["James Rodríguez","Radamel Falcao","Juan Cuadrado","Davinson Sánchez","Luis Díaz","Yerry Mina","Jhon Córdoba","Roger Martínez"],
  cod:["Yannick Bolasie","Chancel Mbemba","Cedric Bakambu","Théo Bongonda","Arthur Masuaku","Merveille Bongonda","Glody Ngonda","Silas Wissa"],
  eng:["Harry Kane","Marcus Rashford","Raheem Sterling","Jordan Pickford","Declan Rice","Jude Bellingham","Bukayo Saka","Phil Foden"],
  cro:["Luka Modrić","Ivan Perišić","Marcelo Brozović","Ante Rebić","Dejan Lovren","Joško Gvardiol","Mateo Kovačić","Ivan Rakitić"],
  pan:["Rommel Quiñones","Blas Pérez","Adolfo Machado","Anibal Godoy","Fidel Escobar","Armando Cooper","Cecilio Waterman","Édgar Bárcenas"],
  gha:["Thomas Partey","Jordan Ayew","André Ayew","Inaki Williams","Mohammed Salisu","Felix Afena-Gyan","Kudus Mohammed","Kamaldeen Sulemana"],
};

// --- PLAYER SELECT ------------------------------------------------------------
function PlayerSelect({value, onChange}) {
  const [teamId, setTeamId] = useState(
    value ? Object.entries(PLAYERS).find(([,players])=>players.includes(value))?.[0] || "" : ""
  );
  const [open, setOpen] = useState(false);
  const players = teamId ? (PLAYERS[teamId] || []) : [];
  const team = teamId ? T[teamId] : null;

  const handleTeamChange = (id) => {
    setTeamId(id);
    onChange(""); // reset player when team changes
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
      {/* Step 1: pick team */}
      <TeamSelect value={teamId} onChange={handleTeamChange} placeholder="1. Elegir selección..."/>
      {/* Step 2: pick player */}
      {teamId && (
        <div style={{position:"relative"}}>
          <button onClick={()=>setOpen(p=>!p)}
            style={{...S.btn,width:"100%",padding:"0.625rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem",
              background:"rgba(255,255,255,0.05)",border:`1px solid ${open?"rgba(251,191,36,0.5)":"rgba(255,255,255,0.12)"}`,
              justifyContent:"space-between",textAlign:"left"}}>
            {value
              ? <span style={{fontSize:"0.8rem",fontWeight:700,color:"white"}}>👤 {value}</span>
              : <span style={{fontSize:"0.8rem",color:C.muted}}>2. Elegir jugador...</span>
            }
            <span style={{color:C.muted,fontSize:"0.7rem"}}>{open?"▲":"▼"}</span>
          </button>
          {open && (
            <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:999,
              background:"#1a2a1a",border:`1px solid rgba(255,255,255,0.15)`,borderRadius:"0.75rem",
              overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
              <div style={{maxHeight:"200px",overflowY:"auto"}}>
                {players.map(p=>(
                  <div key={p} onClick={()=>{onChange(p);setOpen(false);}}
                    style={{padding:"0.5rem 0.75rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",
                      background:value===p?"rgba(251,191,36,0.12)":"transparent",
                      borderTop:`1px solid rgba(255,255,255,0.04)`}}>
                    <FlagImg team={team} size={18}/>
                    <span style={{fontSize:"0.8rem",fontWeight:value===p?700:500,color:value===p?C.gold:"white"}}>{p}</span>
                    {value===p&&<span style={{marginLeft:"auto",color:C.gold}}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {open&&<div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:998}}/>}
        </div>
      )}
      {/* Preview */}
      {value && team && (
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.35rem 0.6rem",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:"0.6rem"}}>
          <FlagImg team={team} size={20}/>
          <span style={{fontSize:"0.75rem",fontWeight:900,color:"white"}}>{value}</span>
          <span style={{fontSize:"0.6rem",color:C.muted}}>({team.name})</span>
        </div>
      )}
    </div>
  );
}

// --- GRASS BACKGROUND ---------------------------------------------------------
function GrassBg() {
  return (
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",background:"#0a1a0a"}}/>
  );
}

// --- SCORE INPUT --------------------------------------------------------------
function ScoreInput({value,onChange,disabled}) {
  return (
    <input type="number" min="0" max="99" value={value} placeholder="–"
      onChange={e=>onChange(e.target.value)} disabled={disabled}
      style={{width:"3rem",height:"3rem",textAlign:"center",fontSize:"1.25rem",fontWeight:900,
        background:disabled?"rgba(251,113,133,0.12)":"rgba(255,255,255,0.07)",
        border:`2px solid ${disabled?"rgba(251,113,133,0.35)":"rgba(255,255,255,0.15)"}`,
        borderRadius:"0.75rem",color:disabled?"rgba(251,113,133,0.6)":"white",
        outline:"none",cursor:disabled?"not-allowed":"text",fontFamily:"inherit",
        WebkitAppearance:"none",MozAppearance:"textfield"}}/>
  );
}

// --- MATCH CARD ---------------------------------------------------------------
function MatchCard({match,scores,onScore,isJoker,onJoker,jokersLeft,adminMode=false}) {
  const home=T[match.home],away=T[match.away];
  const s=scores[match.id]||{home:"",away:""};
  const h=parseInt(s.home),a=parseInt(s.away),has=!isNaN(h)&&!isNaN(a);
  const res=!has?null:h>a?"home":a>h?"away":"draw";
  const locked=adminMode?false:isLocked(match.id);
  const canJoker=!locked&&(isJoker||jokersLeft>0);

  const resColor = res==="draw"?"rgba(96,165,250,0.15)":res==="home"?"rgba(52,211,153,0.12)":res==="away"?"rgba(251,113,133,0.12)":"transparent";

  return (
    <div style={{position:"relative",background:`${C.surface}`,border:`1px solid ${isJoker?"rgba(251,191,36,0.5)":C.border}`,borderRadius:"1rem",overflow:"hidden",background:`linear-gradient(135deg,${resColor},${C.surface})`}}>
      {/* Top strip */}
      <div style={{padding:"0.4rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem",borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontSize:"0.6rem",fontWeight:900,background:"rgba(251,191,36,0.15)",color:C.gold,padding:"0.2rem 0.4rem",borderRadius:"0.3rem",letterSpacing:"0.1em"}}>GRP {match.group}</span>
        <span style={{fontSize:"0.65rem",fontWeight:700,color:C.muted}}>{match.time} <span style={{color:C.faint}}>BOT</span></span>
        {locked&&<span style={{fontSize:"0.6rem",fontWeight:900,background:"rgba(251,113,133,0.15)",color:C.rose,padding:"0.2rem 0.4rem",borderRadius:"0.3rem"}}>🔒 CERRADO</span>}
        <span style={{flex:1}}/>
        {onJoker&&(
          <button onClick={()=>canJoker&&onJoker(match.id)} disabled={!canJoker&&!isJoker}
            style={{...S.btn,display:"flex",alignItems:"center",gap:"0.25rem",padding:"0.2rem 0.5rem",
              fontSize:"0.65rem",fontWeight:900,letterSpacing:"0.05em",
              background:isJoker?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.06)",
              color:isJoker?C.gold:"rgba(255,255,255,0.25)",
              border:`1px solid ${isJoker?"rgba(251,191,36,0.45)":"rgba(255,255,255,0.1)"}`,
              opacity:!canJoker&&!isJoker?0.4:1}}>
            🃏 x2
          </button>
        )}
        <span style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"110px"}}>{match.venue}</span>
      </div>
      {/* Teams + inputs */}
      <div style={{padding:"0.5rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem",opacity:res==="away"?0.35:1}}>
          <FlagImg team={home} size={36}/>
          <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <span style={{fontSize:"0.8rem",fontWeight:900,color:"white",letterSpacing:"0.05em"}}>{home.short}{home.host?" 🏠":""}</span>
            {res==="home"&&<span style={{fontSize:"0.55rem",fontWeight:900,padding:"0.1rem 0.35rem",borderRadius:"99px",background:"rgba(52,211,153,0.2)",color:C.emerald}}>GANA</span>}
          </div>
          <span style={{fontSize:"0.6rem",color:C.muted,textAlign:"center"}}>{home.name}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem",flexShrink:0}}>
          {/* Result badge above scores — only for draw */}
          {has && res==="draw" && (
            <div style={{fontSize:"0.6rem",fontWeight:900,padding:"0.15rem 0.5rem",borderRadius:"99px",
              background:"rgba(96,165,250,0.2)",color:"#93c5fd",letterSpacing:"0.08em"}}>
              EMPATE
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <ScoreInput value={s.home} onChange={v=>onScore(match.id,"home",v)} disabled={locked}/>
            <span style={{color:"rgba(255,255,255,0.3)",fontWeight:900,fontSize:"1rem"}}>–</span>
            <ScoreInput value={s.away} onChange={v=>onScore(match.id,"away",v)} disabled={locked}/>
          </div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem",opacity:res==="home"?0.35:1}}>
          <FlagImg team={away} size={36}/>
          <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <span style={{fontSize:"0.8rem",fontWeight:900,color:"white",letterSpacing:"0.05em"}}>{away.short}</span>
            {res==="away"&&<span style={{fontSize:"0.55rem",fontWeight:900,padding:"0.1rem 0.35rem",borderRadius:"99px",background:"rgba(52,211,153,0.2)",color:C.emerald}}>GANA</span>}
          </div>
          <span style={{fontSize:"0.6rem",color:C.muted,textAlign:"center"}}>{away.name}</span>
        </div>
      </div>
    </div>
  );
}

// --- ACCORDION WRAPPER --------------------------------------------------------
function Accordion({open,onToggle,badge,badgeColor,title,sub,right,children}) {
  return (
    <div style={{marginBottom:"0.5rem"}}>
      <button onClick={onToggle} style={S.accordion(open)}>
        <div style={{...S.badge,background:badgeColor,color:"#000"}}>{badge}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:"1.15rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em",color:"white",lineHeight:1.1}}>{title}</div>
          {sub&&<div style={{fontSize:"0.65rem",color:C.muted,marginTop:"0.2rem"}}>{sub}</div>}
        </div>
        {right&&<div style={{color:C.muted,fontSize:"0.7rem",fontWeight:700,flexShrink:0,textAlign:"right"}}>{right}</div>}
        <svg style={{...S.chevron,transform:open?"rotate(180deg)":"rotate(0deg)"}} fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.4)" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
      </button>
      {open&&<div style={{marginTop:"0.5rem"}}>{children}</div>}
    </div>
  );
}

// --- FECHA SECTION ------------------------------------------------------------
function FechaSection({fecha,index,isOpen,onToggle,scores,onScore,jokers,onJoker,jLeft}) {
  const groups=[...new Set(fecha.matches.map(m=>m.group))].sort();
  const played=fecha.matches.filter(m=>{const s=scores[m.id];return s&&!isNaN(parseInt(s.home))&&!isNaN(parseInt(s.away));}).length;
  return (
    <Accordion open={isOpen} onToggle={onToggle} badge={fecha.id} badgeColor={FBADGES[index%FBADGES.length]}
      title={fecha.label} sub={`${fecha.sub} · BOT`}
      right={`${played}/${fecha.matches.length} · ${groups.map(g=>"G"+g).join(" ")}`}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"0.5rem"}}>
        {fecha.matches.map(m=>(
          <MatchCard key={m.id} match={m} scores={scores} onScore={onScore}
            isJoker={jokers?.includes(m.id)} onJoker={onJoker} jokersLeft={jLeft}/>
        ))}
      </div>
    </Accordion>
  );
}

// --- GROUP TABLE --------------------------------------------------------------
function GroupTable({gid,gi,scores,isOpen,onToggle}) {
  const table=computeTable(gid,scores);
  const played=Math.round(table.reduce((s,t)=>s+t.pj,0)/2);
  const cols=["PJ","G","E","P","GF","GC","DF","PTS"];
  const flagSub = GROUPS[gid].map(id=>T[id].flag).join("  ");
  return (
    <Accordion open={isOpen} onToggle={onToggle} badge={gid} badgeColor={GCOLORS[gi%GCOLORS.length]}
      title={`Grupo ${gid}`} sub={flagSub} right={`${played}/6 PJ`}>
      <div style={{...S.card}}>
        {/* header */}
        <div style={{display:"grid",gridTemplateColumns:"1.5rem 1fr repeat(8,2rem)",gap:"0.25rem",padding:"0.4rem 0.5rem",background:"rgba(255,255,255,0.05)",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:"0.55rem",color:C.muted,fontWeight:900,textTransform:"uppercase"}}>#</span>
          <span style={{fontSize:"0.55rem",color:C.muted,fontWeight:900,textTransform:"uppercase"}}>Selección</span>
          {cols.map(c=><span key={c} style={{fontSize:"0.55rem",color:c==="PTS"?C.gold:C.muted,fontWeight:900,textTransform:"uppercase",textAlign:"center"}}>{c}</span>)}
        </div>
        {table.map((team,i)=>(
          <div key={team.id} style={{display:"grid",gridTemplateColumns:"1.5rem 1fr repeat(8,2rem)",gap:"0.25rem",padding:"0.4rem 0.5rem",background:i<2?"rgba(52,211,153,0.04)":"transparent",borderTop:`1px solid ${C.border}`,alignItems:"center"}}>
            <span style={{fontSize:"0.7rem",fontWeight:900,color:i===0?C.gold:i===1?"#94a3b8":i===2?"#b45309":"rgba(255,255,255,0.3)"}}>{i+1}</span>
            <div style={{display:"flex",alignItems:"center",gap:"0.4rem",minWidth:0}}>
              <FlagImg team={team} size={20}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:"0.75rem",fontWeight:900,color:"white",whiteSpace:"nowrap"}}>{team.short}{i<2?" ▲":""}</div>
                <div style={{fontSize:"0.6rem",color:C.muted,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team.name}</div>
              </div>
            </div>
            {[team.pj,team.pg,team.pe,team.pp,team.gf,team.gc].map((v,j)=>(
              <span key={j} style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.7)",fontWeight:600,textAlign:"center"}}>{v}</span>
            ))}
            <span style={{fontSize:"0.75rem",fontWeight:700,textAlign:"center",color:team.dg>0?C.emerald:team.dg<0?C.rose:"rgba(255,255,255,0.6)"}}>{team.dg>0?"+"+team.dg:team.dg}</span>
            <div style={{display:"flex",justifyContent:"center"}}>
              <span style={{minWidth:"1.75rem",height:"1.5rem",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"0.4rem",fontSize:"0.75rem",fontWeight:900,
                background:team.pts>0?i===0?"linear-gradient(135deg,#f59e0b,#fcd34d)":i===1?"linear-gradient(135deg,#94a3b8,#cbd5e1)":i===2?"linear-gradient(135deg,#b45309,#d97706)":"rgba(255,255,255,0.08)":"rgba(255,255,255,0.05)",
                color:team.pts>0&&i<3?"#000":"rgba(255,255,255,0.5)"}}>
                {team.pts}
              </span>
            </div>
          </div>
        ))}
        <div style={{padding:"0.35rem 0.5rem",borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:"0.4rem"}}>
          <div style={{width:"8px",height:"8px",borderRadius:"2px",background:"rgba(52,211,153,0.3)",border:"1px solid rgba(52,211,153,0.5)"}}/>
          <span style={{fontSize:"0.55rem",color:"rgba(255,255,255,0.25)"}}>Top 2 clasifican a la Ronda de 32</span>
        </div>
      </div>
    </Accordion>
  );
}

// --- CUSTOM TEAM SELECTOR ----------------------------------------------------
function TeamSelect({value, onChange, placeholder="— Elegir selección —"}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = value ? T[value] : null;
  const filtered = TEAMS_LIST.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.short.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{position:"relative"}}>
      {/* Trigger */}
      <button onClick={()=>{setOpen(p=>!p);setSearch("");}}
        style={{...S.btn,width:"100%",padding:"0.625rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem",
          background:"rgba(255,255,255,0.05)",border:`1px solid ${open?"rgba(251,191,36,0.5)":"rgba(255,255,255,0.12)"}`,
          justifyContent:"space-between",textAlign:"left"}}>
        {selected
          ? <span style={{display:"flex",alignItems:"center",gap:"0.5rem"}}><FlagImg team={selected} size={20}/><span style={{fontSize:"0.8rem",fontWeight:700,color:"white"}}>{selected.name}</span></span>
          : <span style={{fontSize:"0.8rem",color:C.muted}}>{placeholder}</span>
        }
        <span style={{color:C.muted,fontSize:"0.7rem",flexShrink:0}}>{open?"▲":"▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:999,
          background:"#1a2a1a",border:`1px solid rgba(255,255,255,0.15)`,borderRadius:"0.75rem",
          overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
          {/* Search */}
          <div style={{padding:"0.5rem"}}>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Buscar selección..." autoFocus
              style={{...S.input,fontSize:"0.75rem",padding:"0.4rem 0.6rem"}}/>
          </div>
          {/* Clear option */}
          <div onClick={()=>{onChange("");setOpen(false);}}
            style={{padding:"0.4rem 0.75rem",cursor:"pointer",fontSize:"0.75rem",color:C.muted,
              borderTop:`1px solid rgba(255,255,255,0.07)`,
              background:!value?"rgba(255,255,255,0.05)":"transparent"}}>
            — Sin selección —
          </div>
          {/* Options */}
          <div style={{maxHeight:"220px",overflowY:"auto"}}>
            {filtered.map(team=>(
              <div key={team.id} onClick={()=>{onChange(team.id);setOpen(false);setSearch("");}}
                style={{padding:"0.4rem 0.75rem",cursor:"pointer",display:"flex",alignItems:"center",gap:"0.5rem",
                  background:value===team.id?"rgba(251,191,36,0.12)":"transparent",
                  borderTop:`1px solid rgba(255,255,255,0.04)`}}>
                <FlagImg team={team} size={20}/>
                <div>
                  <div style={{fontSize:"0.78rem",fontWeight:700,color:value===team.id?C.gold:"white"}}>{team.name}</div>
                  <div style={{fontSize:"0.6rem",color:C.muted}}>{team.short}</div>
                </div>
                {value===team.id&&<span style={{marginLeft:"auto",color:C.gold,fontSize:"0.7rem"}}>✓</span>}
              </div>
            ))}
            {filtered.length===0&&<div style={{padding:"0.75rem",textAlign:"center",color:C.muted,fontSize:"0.75rem"}}>Sin resultados</div>}
          </div>
        </div>
      )}

      {/* Overlay to close */}
      {open&&<div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,zIndex:998}}/>}
    </div>
  );
}
function SpecialPicks({sp,onChange,isOpen,onToggle,locked=false,designatedLocked=false}) {
  const grupos=sp.clasificados?.grupos||{};
  const total=Object.values(grupos).reduce((s,a)=>s+(a?.length||0),0);
  const filled=[sp.campeon,sp.subcampeon,sp.goleador,sp.goleadorDesignado,sp.arqueroDesignado].filter(Boolean).length + (total===32?1:0);

  const toggleGrupo=(gid,tid)=>{
    if(locked) return;
    const cur=grupos[gid]||[];
    const thirdsCount = Object.values(grupos).filter(a=>a?.length===3).length;
    if(cur.includes(tid)){
      const next=cur.filter(x=>x!==tid);
      onChange("clasificados",{...sp.clasificados,grupos:{...grupos,[gid]:next}});
      return;
    }
    if(total>=32) return; // global max
    if(cur.length>=3) return; // group max
    // If this would be the 3rd pick, check 8-thirds limit
    if(cur.length===2 && thirdsCount>=8) return;
    onChange("clasificados",{...sp.clasificados,grupos:{...grupos,[gid]:[...cur,tid]}});
  };

  const teamField=(key,label,icon)=>(
    <div style={{marginBottom:"1rem"}}>
      <label style={S.label}>{icon} {label}</label>
      <TeamSelect value={sp[key]||""} onChange={v=>{ if(!locked) onChange(key,v); }} disabled={locked}/>
      {sp[key]&&T[sp[key]]&&<div style={{marginTop:"0.4rem",display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.6rem",background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:"0.6rem"}}>
        <FlagImg team={T[sp[key]]} size={20}/>
        <span style={{fontSize:"0.75rem",fontWeight:900,color:"white"}}>{T[sp[key]].short}</span>
        <span style={{fontSize:"0.65rem",color:C.muted}}>{T[sp[key]].name}</span>
      </div>}
    </div>
  );

  const playerField=(key,label,icon,extraLocked=false)=>{
    const isFieldLocked = locked || extraLocked;
    return (
    <div style={{marginBottom:"1rem"}}>
      <label style={S.label}>{icon} {label}{extraLocked&&!locked&&<span style={{marginLeft:"0.4rem",fontSize:"0.55rem",fontWeight:900,background:"rgba(251,113,133,0.15)",color:"#fb7185",padding:"0.15rem 0.35rem",borderRadius:"0.3rem"}}>🔒 CERRADO</span>}</label>
      <PlayerSelect value={sp[key]||""} onChange={v=>{ if(!isFieldLocked) onChange(key,v); }} disabled={isFieldLocked}/>
    </div>
  );};

  return (
    <Accordion open={isOpen} onToggle={onToggle} badge="⭐" badgeColor={C.gold}
      title="Pronósticos Especiales" sub="Campeón · Goleador · Arquero · Clasificados"
      right={locked ? <span style={{fontSize:"0.6rem",fontWeight:900,background:"rgba(251,113,133,0.15)",color:"#fb7185",padding:"0.2rem 0.5rem",borderRadius:"0.3rem"}}>🔒 CERRADO</span> : `${filled}/6`}>
      <div style={{...S.card,padding:"1rem"}}>
        {locked && (
          <div style={{marginBottom:"1rem",padding:"0.5rem 0.75rem",background:"rgba(251,113,133,0.08)",border:"1px solid rgba(251,113,133,0.25)",borderRadius:"0.6rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <span style={{fontSize:"1rem"}}>🔒</span>
            <span style={{fontSize:"0.7rem",fontWeight:700,color:"#fb7185"}}>Pronósticos especiales cerrados — México vs Corea ya comenzó</span>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"0rem 1.5rem",opacity:locked?0.6:1,pointerEvents:locked?"none":"auto"}}>
          {teamField("campeon","Campeón","🏆")}
          {teamField("subcampeon","Subcampeón","🥈")}
          {playerField("goleador","Goleador (+10pts)","👟")}
          {playerField("goleadorDesignado","Goleador Designado (+1pt/gol)","⭐",designatedLocked)}
          {playerField("arqueroDesignado","Arquero Designado (+1pt/arco en 0)","🧤",designatedLocked)}
        </div>

        {/* Clasificados */}
        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:"1rem",marginTop:"0.5rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.75rem"}}>
            <div>
              <div style={{fontSize:"0.8rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em",color:"white"}}>🎯 Clasificados a 16avos</div>
              <div style={{fontSize:"0.6rem",color:C.muted,marginTop:"0.15rem"}}>Hasta 3 por grupo · 1°/2° +{PTS_CLASIFICADO}pt · 3° +{PTS_TERCERO}pts</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <span style={{fontSize:"0.8rem",fontWeight:900,padding:"0.25rem 0.6rem",borderRadius:"99px",background:total===32?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.08)",color:total===32?C.emerald:C.muted}}>{total}/32</span>
              <span style={{fontSize:"0.7rem",fontWeight:700,padding:"0.2rem 0.5rem",borderRadius:"99px",background:"rgba(251,191,36,0.1)",color:C.gold}}>
                {Object.values(grupos).filter(a=>a?.length===3).length}/8 terceros
              </span>
              {total>0&&!locked&&<button onClick={()=>onChange("clasificados",{grupos:{}})} style={{...S.btn,padding:"0.2rem 0.5rem",fontSize:"0.6rem",background:"rgba(251,113,133,0.15)",color:C.rose,border:"none"}}>Limpiar</button>}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"0.5rem"}}>
            {Object.entries(GROUPS).map(([gid,tids],gi)=>{
              const sel=grupos[gid]||[],full=sel.length>=3,gFull=total>=32;
              return (
                <div key={gid} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:"0.75rem",padding:"0.5rem"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.4rem"}}>
                    <span style={{fontSize:"0.6rem",fontWeight:900,padding:"0.15rem 0.35rem",borderRadius:"0.3rem",background:GCOLORS[gi%GCOLORS.length],color:"#000"}}>GRP {gid}</span>
                    <span style={{fontSize:"0.6rem",fontWeight:700,color:sel.length===3?C.gold:sel.length===2?C.emerald:C.muted}}>{sel.length}/3</span>
                  </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.25rem"}}>
                    {tids.map(tid=>{
                      const team=T[tid],isSel=sel.includes(tid),pos=sel.indexOf(tid),isThird=isSel&&pos===2;
                      const thirdsCount=Object.values(grupos).filter(a=>a?.length===3).length;
                      const wouldBeThird=!isSel&&sel.length===2;
                      const disabled=!isSel&&(full||gFull||total>=32||(wouldBeThird&&thirdsCount>=8));
                      return (
                        <button key={tid} onClick={()=>toggleGrupo(gid,tid)} disabled={disabled}
                          style={{...S.btn,padding:"0.3rem 0.2rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.1rem",
                            background:isThird?"rgba(251,191,36,0.15)":isSel?"rgba(52,211,153,0.15)":disabled?"rgba(255,255,255,0.02)":"rgba(255,255,255,0.05)",
                            border:`1px solid ${isThird?"rgba(251,191,36,0.4)":isSel?"rgba(52,211,153,0.4)":"rgba(255,255,255,0.08)"}`,
                            opacity:disabled?0.3:1}}>
                          <span style={{fontSize:"0.6rem",fontWeight:900,color:isThird?C.gold:isSel?C.emerald:"white",textAlign:"center",lineHeight:1.2,wordBreak:"break-word"}}>{team.name}</span>
                          {isSel&&<span style={{fontSize:"0.5rem",fontWeight:900,color:isThird?C.gold:C.emerald}}>{isThird?"3°":"✓"}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Accordion>
  );
}

// --- PENDING USERS ------------------------------------------------------------
function PendingUsers() {
  const [pending,setPending] = useState([]);
  const [approved,setApproved] = useState([]);
  const [loading,setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [p,a] = await Promise.all([sGetPendingUsers(), sGetApprovedUsers()]);
    setPending(p); setApproved(a); setLoading(false);
  };

  useEffect(()=>{ load(); },[]);

  const approve = async (un) => {
    await sApproveUser(un);
    load();
  };

  const reject = async (un) => {
    if(!window.confirm(`¿Rechazar y eliminar a ${un}?`)) return;
    await sRejectUser(un);
    load();
  };

  const bo = `1px solid ${C.border}`;

  return (
    <div style={{...S.card,padding:"1rem",marginBottom:"1rem",border:`1px solid rgba(52,211,153,0.2)`,background:"rgba(52,211,153,0.03)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.75rem"}}>
        <div style={{fontSize:"0.75rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.1em",color:C.emerald}}>
          Usuarios {pending.length>0&&<span style={{background:"rgba(251,113,133,0.2)",color:C.rose,padding:"0.1rem 0.4rem",borderRadius:"99px",fontSize:"0.7rem"}}>{pending.length} pendiente{pending.length!==1?"s":""}</span>}
        </div>
        <button onClick={load} style={{...S.btn,padding:"0.25rem 0.6rem",background:"rgba(255,255,255,0.06)",border:bo,color:C.muted,fontSize:"0.65rem"}}>↻</button>
      </div>

      {loading ? <div style={{fontSize:"0.7rem",color:C.muted}}>Cargando...</div> : (<>

        {/* Pending */}
        {pending.length>0&&<>
          <div style={{fontSize:"0.65rem",fontWeight:900,color:C.rose,textTransform:"uppercase",marginBottom:"0.4rem"}}>⏳ Pendientes de aprobación</div>
          {pending.map(u=>(
            <div key={u.username} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.5rem",background:"rgba(251,113,133,0.06)",border:`1px solid rgba(251,113,133,0.15)`,borderRadius:"0.6rem",marginBottom:"0.3rem"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.75rem",fontWeight:700,color:"white",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.full_name||u.username}</div>
                <div style={{fontSize:"0.6rem",color:C.muted}}>@{u.username}</div>
              </div>
              <button onClick={()=>approve(u.username)} style={{...S.btn,padding:"0.3rem 0.6rem",background:"rgba(52,211,153,0.15)",border:`1px solid rgba(52,211,153,0.3)`,color:C.emerald,fontSize:"0.7rem",fontWeight:900}}>✅ Aprobar</button>
              <button onClick={()=>reject(u.username)} style={{...S.btn,padding:"0.3rem 0.6rem",background:"rgba(239,68,68,0.1)",border:`1px solid rgba(239,68,68,0.2)`,color:"#fca5a5",fontSize:"0.7rem",fontWeight:900}}>❌</button>
            </div>
          ))}
        </>}

        {/* Approved */}
        {approved.length>0&&<>
          <div style={{fontSize:"0.65rem",fontWeight:900,color:C.emerald,textTransform:"uppercase",marginBottom:"0.4rem",marginTop:pending.length>0?"0.75rem":"0"}}>✅ Aprobados ({approved.length})</div>
          {approved.map(u=>(
            <div key={u.username} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.35rem 0.5rem",background:"rgba(255,255,255,0.03)",border:bo,borderRadius:"0.6rem",marginBottom:"0.25rem"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.72rem",fontWeight:700,color:"rgba(255,255,255,0.8)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.full_name||u.username}</div>
                <div style={{fontSize:"0.58rem",color:C.muted}}>@{u.username}</div>
              </div>
              <button onClick={()=>reject(u.username)} style={{...S.btn,padding:"0.25rem 0.5rem",background:"rgba(239,68,68,0.08)",border:`1px solid rgba(239,68,68,0.15)`,color:"#fca5a5",fontSize:"0.65rem"}}>🗑️</button>
            </div>
          ))}
        </>}

        {pending.length===0&&approved.length===0&&<div style={{fontSize:"0.7rem",color:C.muted,textAlign:"center",padding:"0.5rem"}}>No hay usuarios registrados</div>}
      </>)}
    </div>
  );
}

// --- ADMIN PANEL --------------------------------------------------------------

// --- DESIGNADOS ADMIN SECTION -------------------------------------------------
function DesignadosAdminSection({rsp, setRsp}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    const load = async () => {
      setLoading(true);
      try {
        const [users, spData] = await Promise.all([
          sGetApprovedUsers(),
          sbFetch("specials?select=username,data")
        ]);
        const spMap = {};
        (spData||[]).forEach(r=>{ spMap[r.username]=r.data||{}; });
        const rows = users.map(u=>({
          username: u.username,
          fullName: u.full_name||u.username,
          goleadorDesignado: spMap[u.username]?.goleadorDesignado||"",
          arqueroDesignado: spMap[u.username]?.arqueroDesignado||"",
        }));
        setData(rows);
      } catch(_){}
      setLoading(false);
    };
    load();
  },[]);

  // Get unique designated players
  const goleadores = [...new Set(data.map(u=>u.goleadorDesignado).filter(Boolean))];
  const arqueros   = [...new Set(data.map(u=>u.arqueroDesignado).filter(Boolean))];

  const getUsersFor = (list, key, player) =>
    list.filter(u=>u[key]===player).map(u=>u.fullName).join(", ");

  if(loading) return <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)",padding:"0.5rem 0"}}>Cargando designados...</div>;

  if(!isDesignatedLocked()) return (
    <div style={{marginTop:"0.75rem",padding:"0.5rem 0.75rem",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"0.6rem"}}>
      <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)"}}>🔒 Los designados se revelan el 14 mayo a las 07:50 BOT</span>
    </div>
  );

  return (
    <div style={{marginTop:"0.75rem",borderTop:`1px solid rgba(255,255,255,0.08)`,paddingTop:"0.75rem"}}>

      {/* Goleadores Designados */}
      {goleadores.length > 0 && (
        <div style={{marginBottom:"0.75rem"}}>
          <div style={{fontSize:"0.65rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.08em",color:"#fb7185",marginBottom:"0.4rem"}}>👟 Goles — Goleadores Designados</div>
          <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
            {goleadores.map(player=>(
              <div key={player} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.6rem",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"0.5rem"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:"0.72rem",fontWeight:700,color:"white"}}>{player}</div>
                  <div style={{fontSize:"0.55rem",color:"rgba(255,255,255,0.35)",marginTop:"0.1rem"}}>{getUsersFor(data,"goleadorDesignado",player)}</div>
                </div>
                <input type="number" min="0" max="99"
                  value={rsp.goleadoresDesignados?.[player]||""}
                  onChange={e=>setRsp(p=>({...p,goleadoresDesignados:{...p.goleadoresDesignados,[player]:e.target.value}}))}
                  placeholder="0"
                  style={{width:"3rem",height:"2rem",textAlign:"center",fontSize:"0.85rem",fontWeight:900,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"0.4rem",color:"white",outline:"none",fontFamily:FONT,WebkitAppearance:"none",MozAppearance:"textfield"}}/>
                <span style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.3)"}}>goles</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arqueros Designados */}
      {arqueros.length > 0 && (
        <div>
          <div style={{fontSize:"0.65rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.08em",color:"#38bdf8",marginBottom:"0.4rem"}}>🧤 Arcos en 0 — Arqueros Designados</div>
          <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
            {arqueros.map(player=>(
              <div key={player} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem 0.6rem",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:"0.5rem"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:"0.72rem",fontWeight:700,color:"white"}}>{player}</div>
                  <div style={{fontSize:"0.55rem",color:"rgba(255,255,255,0.35)",marginTop:"0.1rem"}}>{getUsersFor(data,"arqueroDesignado",player)}</div>
                </div>
                <input type="number" min="0" max="99"
                  value={rsp.arquerosDesignados?.[player]||""}
                  onChange={e=>setRsp(p=>({...p,arquerosDesignados:{...p.arquerosDesignados,[player]:e.target.value}}))}
                  placeholder="0"
                  style={{width:"3rem",height:"2rem",textAlign:"center",fontSize:"0.85rem",fontWeight:900,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"0.4rem",color:"white",outline:"none",fontFamily:FONT,WebkitAppearance:"none",MozAppearance:"textfield"}}/>
                <span style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.3)"}}>arcos en 0</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {goleadores.length===0 && arqueros.length===0 && (
        <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)"}}>Ningún usuario ha seleccionado designados aún.</div>
      )}
    </div>
  );
}


// Find which team a player belongs to
function getPlayerTeam(playerName) {
  if(!playerName) return null;
  const lower = playerName.trim().toLowerCase();
  for(const [team, players] of Object.entries(PLAYERS)) {
    if(players.some(p=>p.trim().toLowerCase()===lower)) return team;
  }
  return null;
}

// Get designated players that participated in a match
function getDesignadosForMatch(match, goleadoresDesignados, arquerosDesignados) {
  const homeTeam = match.home, awayTeam = match.away;
  const result = {goleadores:[], arqueros:[]};
  for(const [player] of Object.entries(goleadoresDesignados||{})) {
    const team = getPlayerTeam(player);
    if(team===homeTeam||team===awayTeam) result.goleadores.push(player);
  }
  for(const [player] of Object.entries(arquerosDesignados||{})) {
    const team = getPlayerTeam(player);
    if(team===homeTeam||team===awayTeam) result.arqueros.push(player);
  }
  return result;
}

function AdminPanel({onLogout}) {
  const [res,setRes]=useState(emptyScores);
  const [rsp,setRsp]=useState({campeon:"",subcampeon:"",goleador:"",goleadoresDesignados:{},arquerosDesignados:{},designadoEvents:{},clasificados:{grupos:{}}});
  const [koRes,setKoRes]=useState({});
  const [openF,setOpenF]=useState(null);
  const [vis,setVis]=useState(PAGE_SIZE);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    sGetRealResults().then(r=>{if(r){if(Object.keys(r.scores||{}).length)setRes(p=>({...p,...r.scores}));if(r.specials&&Object.keys(r.specials).length)setRsp(p=>({...p,...r.specials}));if(r.knockoutResults&&Object.keys(r.knockoutResults).length)setKoRes(r.knockoutResults);}}).catch(()=>{});
  },[]);

  const save=async()=>{
    await sSetRealResults(res, rsp, koRes);
    setSaved(true);setTimeout(()=>setSaved(false),2000);
  };

  const total=ALL_MATCHES.filter(m=>{const s=res[m.id];return s&&!isNaN(parseInt(s.home))&&!isNaN(parseInt(s.away));}).length;
  const vF=FECHAS.slice(0,vis),hM=vis<FECHAS.length,rem=FECHAS.length-vis;

  const adminGrupos=rsp.clasificados?.grupos||{};
  const adminTotal=Object.values(adminGrupos).reduce((s,a)=>s+(a?.length||0),0);
  const toggleAdminClasif=(gid,tid)=>{
    const cur=adminGrupos[gid]||[];
    const thirdsCount=Object.values(adminGrupos).filter(a=>a?.length===3).length;
    if(cur.includes(tid)){
      setRsp(p=>({...p,clasificados:{...p.clasificados,grupos:{...adminGrupos,[gid]:cur.filter(x=>x!==tid)}}}));
      return;
    }
    if(adminTotal>=32||cur.length>=3) return;
    if(cur.length===2&&thirdsCount>=8) return;
    setRsp(p=>({...p,clasificados:{...p.clasificados,grupos:{...adminGrupos,[gid]:[...cur,tid]}}}));
  };

  return (
    <div style={{minHeight:"100vh",fontFamily:FONT,position:"relative",color:"white",WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale"}}>
      <GrassBg/>
      <div style={{position:"relative",zIndex:1,maxWidth:"672px",margin:"0 auto",padding:"1.5rem 1rem"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.5rem",flexWrap:"wrap",gap:"0.5rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
            <div style={{width:"2rem",height:"2rem",borderRadius:"0.75rem",background:"rgba(251,113,133,0.2)",border:"1px solid rgba(251,113,133,0.4)",display:"flex",alignItems:"center",justifyContent:"center",color:C.rose,fontSize:"0.6rem",fontWeight:900}}>ADM</div>
            <div><div style={{fontWeight:900,fontSize:"0.875rem",textTransform:"uppercase"}}>Panel Admin</div><div style={{fontSize:"0.65rem",color:C.muted}}>Carga de resultados reales</div></div>
          </div>
          <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap"}}>
            {saved&&<span style={{fontSize:"0.65rem",fontWeight:700,color:C.emerald}}>✓ guardado</span>}
            <button onClick={save} style={{...S.btn,padding:"0.5rem 1rem",background:`linear-gradient(90deg,#f43f5e,#fb7185)`,color:"white",fontSize:"0.75rem",textTransform:"uppercase",letterSpacing:"0.1em"}}>Guardar</button>
            <button onClick={async()=>{
              if(!window.confirm("¿Borrar TODO? Usuarios, pronósticos y resultados. Esta acción no se puede deshacer.")) return;
              await sDeleteAll();
              alert("Reset total completado. La app se va a recargar.");
              window.location.reload();
            }} style={{...S.btn,padding:"0.5rem 0.75rem",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",color:"#fca5a5",fontSize:"0.7rem",textTransform:"uppercase"}} title="Borra absolutamente todo">
              🗑️ Reset Total
            </button>
            <button onClick={async()=>{
              if(!window.confirm("¿Borrar pronósticos de usuarios y resultados del admin? Los usuarios registrados se mantienen.")) return;
              await sDeleteGameData();
              setRes(emptyScores());
              setRsp({campeon:"",subcampeon:"",goleador:"",goleadoresDesignados:{},arquerosDesignados:{},designadoEvents:{},clasificados:{grupos:{}}});
              setKoRes({});
              alert("Reset completado. Pronósticos y resultados borrados. La app se va a recargar.");
              window.location.reload();
            }} style={{...S.btn,padding:"0.5rem 0.75rem",background:"rgba(251,191,36,0.12)",border:"1px solid rgba(251,191,36,0.3)",color:C.gold,fontSize:"0.7rem",textTransform:"uppercase"}} title="Borra pronósticos y resultados, mantiene usuarios">
              🔄 Reset Pronósticos
            </button>
            <button onClick={onLogout} style={{...S.btn,padding:"0.5rem 0.75rem",background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:"0.75rem",textTransform:"uppercase"}}>Salir</button>
          </div>
        </div>

        {/* Pending Users */}
        <PendingUsers/>

        {/* Progress */}
        <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
          <div style={{fontSize:"1.5rem",fontWeight:900,background:"linear-gradient(90deg,#f43f5e,#fb7185)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>⚽ RESULTADOS REALES</div>
          <div style={{fontSize:"0.7rem",color:C.muted,marginTop:"0.25rem"}}>{total}/{ALL_MATCHES.length} partidos</div>
          <div style={{marginTop:"0.4rem",height:"4px",background:"rgba(255,255,255,0.1)",borderRadius:"99px",overflow:"hidden"}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#f43f5e,#fb7185)",borderRadius:"99px",width:`${(total/ALL_MATCHES.length)*100}%`,transition:"width 0.3s"}}/>
          </div>
        </div>

        {/* Specials */}
        <div style={{...S.card,padding:"1rem",marginBottom:"1rem",border:"1px solid rgba(251,113,133,0.2)",background:"rgba(251,113,133,0.04)"}}>
          <div style={{fontSize:"0.75rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.1em",color:"#fca5a5",marginBottom:"0.75rem"}}>Resultados Especiales</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"0.75rem"}}>
            {[{key:"campeon",label:"🏆 Campeón"},{key:"subcampeon",label:"🥈 Subcampeón"}].map(f=>(
              <div key={f.key}>
                <label style={S.label}>{f.label}</label>
                <TeamSelect value={rsp[f.key]||""} onChange={v=>setRsp(p=>({...p,[f.key]:v}))} placeholder="— Sin definir —"/>
              </div>
            ))}
            <div>
              <label style={S.label}>👟 Goleador Real</label>
              <PlayerSelect value={rsp.goleador||""} onChange={v=>setRsp(p=>({...p,goleador:v}))}/>
            </div>
          </div>{/* end grid */}
          {/* Goleadores y Arqueros Designados — lista dinámica desde usuarios */}
          <DesignadosAdminSection rsp={rsp} setRsp={setRsp}/>
          {/* Admin clasificados */}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:"0.75rem",marginTop:"0.75rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.5rem"}}>
              <label style={{...S.label,marginBottom:0}}>🎯 Clasificados · {adminTotal}/32</label>
              <button onClick={()=>setRsp(p=>({...p,clasificados:{grupos:{}}}))} style={{...S.btn,padding:"0.15rem 0.4rem",fontSize:"0.55rem",background:"rgba(251,113,133,0.1)",color:C.rose,border:"none"}}>Limpiar</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"0.4rem",maxHeight:"16rem",overflowY:"auto"}}>
              {Object.entries(GROUPS).map(([gid,tids],gi)=>{
                const sel=adminGrupos[gid]||[],gFull=sel.length>=3,aFull=adminTotal>=32;
                return (
                  <div key={gid} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:"0.5rem",padding:"0.35rem"}}>
                    <div style={{display:"flex",gap:"0.3rem",alignItems:"center",marginBottom:"0.3rem"}}>
                      <span style={{fontSize:"0.55rem",fontWeight:900,padding:"0.1rem 0.3rem",borderRadius:"0.25rem",background:GCOLORS[gi%GCOLORS.length],color:"#000"}}>GRP {gid}</span>
                      <span style={{fontSize:"0.55rem",color:sel.length===3?C.gold:sel.length===2?C.emerald:C.muted}}>{sel.length}/3</span>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.2rem"}}>
                      {tids.map(tid=>{
                        const team=T[tid],isSel=sel.includes(tid),isThird=isSel&&sel.indexOf(tid)===2;
                        const disabled=!isSel&&(gFull||aFull);
                        return (
                          <button key={tid} onClick={()=>toggleAdminClasif(gid,tid)} disabled={disabled}
                            style={{...S.btn,padding:"0.25rem 0.15rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.1rem",
                              background:isThird?"rgba(251,191,36,0.15)":isSel?"rgba(52,211,153,0.15)":"rgba(255,255,255,0.04)",
                              border:`1px solid ${isThird?"rgba(251,191,36,0.35)":isSel?"rgba(52,211,153,0.35)":"rgba(255,255,255,0.07)"}`,
                              opacity:disabled?0.35:1}}>
                            <span style={{fontSize:"0.58rem",fontWeight:900,color:isThird?C.gold:isSel?C.emerald:"white",textAlign:"center",lineHeight:1.2,wordBreak:"break-word"}}>{team.name}</span>
                            {isSel&&<span style={{fontSize:"0.45rem",fontWeight:900,color:isThird?C.gold:C.emerald}}>{isThird?"3°":"✓"}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Knockout Results */}
        <div style={{...S.card,padding:"1rem",marginBottom:"1rem",border:`1px solid rgba(167,139,250,0.2)`,background:"rgba(167,139,250,0.03)"}}>
          <div style={{fontSize:"0.75rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.1em",color:C.violet,marginBottom:"0.75rem"}}>Resultados Fases Finales</div>
          {(()=>{
            const KO_ROUNDS=[
              {id:"r32",label:"16avos",icon:"⚔️"},{id:"r16",label:"8avos",icon:"🥊"},
              {id:"qf",label:"Cuartos",icon:"🔥"},{id:"sf",label:"Semis",icon:"💥"},
              {id:"third",label:"3° Puesto",icon:"🥉"},{id:"final",label:"Final",icon:"👑"},
            ];
            const r32t=R32_MATCHES.map(m=>({...m,homeId:resolveSlot(m.home,null,res),awayId:resolveSlot(m.away,null,res)}));
            return KO_ROUNDS.map(round=>{
              const matches=round.id==="r32"?r32t:BRACKET[round.id].map(m=>({
                id:m.id,
                homeId:m.loser?resolveKOLoser(m.home,koRes,r32t):resolveKOTeam(m.home,koRes,r32t),
                awayId:m.loser?resolveKOLoser(m.away,koRes,r32t):resolveKOTeam(m.away,koRes,r32t),
              }));
              return(
                <div key={round.id} style={{marginBottom:"0.75rem"}}>
                  <div style={{fontSize:"0.7rem",fontWeight:900,color:C.violet,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.4rem"}}>{round.icon} {round.label}</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"0.4rem"}}>
                    {matches.map((m,i)=>{
                      const hT=m.homeId?T[m.homeId]:null, aT=m.awayId?T[m.awayId]:null;
                      const s=koRes[m.id]||{};
                      const h=parseInt(s.home),a=parseInt(s.away),has=!isNaN(h)&&!isNaN(a);
                      const winner=has&&h!==a?(h>a?hT:aT):null;
                      return(
                        <div key={m.id} style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,borderRadius:"0.75rem",padding:"0.5rem"}}>
                          <div style={{fontSize:"0.55rem",color:C.muted,marginBottom:"0.35rem",fontWeight:700,display:"flex",justifyContent:"space-between"}}>
                            <span>Partido {i+1}</span>
                            {winner&&<span style={{color:C.emerald,fontWeight:900}}>✓ {winner.short}</span>}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
                            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.15rem",opacity:has&&h<a?0.4:1}}>
                              {hT?<><FlagImg team={hT} size={22}/><span style={{fontSize:"0.62rem",fontWeight:900,color:"white"}}>{hT.short}</span></>:<span style={{fontSize:"0.6rem",color:C.muted,fontStyle:"italic"}}>TBD</span>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:"0.2rem",flexShrink:0}}>
                              <input type="number" min="0" max="99" value={s.home||""} placeholder="-"
                                onChange={e=>setKoRes(p=>({...p,[m.id]:{...p[m.id],home:e.target.value,homeTeam:m.homeId,awayTeam:m.awayId}}))}
                                style={{width:"2.25rem",height:"2.25rem",textAlign:"center",fontSize:"0.9rem",fontWeight:900,background:"rgba(255,255,255,0.08)",border:`1px solid ${C.border}`,borderRadius:"0.5rem",color:"white",outline:"none",fontFamily:FONT,WebkitAppearance:"none",MozAppearance:"textfield"}}/>
                              <span style={{color:C.muted,fontSize:"0.8rem"}}>-</span>
                              <input type="number" min="0" max="99" value={s.away||""} placeholder="-"
                                onChange={e=>setKoRes(p=>({...p,[m.id]:{...p[m.id],away:e.target.value,homeTeam:m.homeId,awayTeam:m.awayId}}))}
                                style={{width:"2.25rem",height:"2.25rem",textAlign:"center",fontSize:"0.9rem",fontWeight:900,background:"rgba(255,255,255,0.08)",border:`1px solid ${C.border}`,borderRadius:"0.5rem",color:"white",outline:"none",fontFamily:FONT,WebkitAppearance:"none",MozAppearance:"textfield"}}/>
                            </div>
                            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.15rem",opacity:has&&h>a?0.4:1}}>
                              {aT?<><FlagImg team={aT} size={22}/><span style={{fontSize:"0.62rem",fontWeight:900,color:"white"}}>{aT.short}</span></>:<span style={{fontSize:"0.6rem",color:C.muted,fontStyle:"italic"}}>TBD</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}
          <button onClick={()=>{sSetRealResults(res,rsp,koRes).then(()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);});}}
            style={{...S.btn,marginTop:"0.5rem",padding:"0.5rem 1rem",background:`linear-gradient(90deg,${C.violet},#c4b5fd)`,color:"#000",fontSize:"0.75rem",fontWeight:900,textTransform:"uppercase"}}>
            Guardar Fases Finales
          </button>
        </div>

        {/* Match results */}
        <div style={{fontSize:"0.75rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.1em",color:"#fca5a5",marginBottom:"0.5rem"}}>Resultados por Fecha</div>
        <div style={{height:"420px",overflowY:"auto",paddingRight:"4px"}}>
          {vF.map(f=>(
            <Accordion key={f.id} open={openF===f.id} onToggle={()=>setOpenF(p=>p===f.id?null:f.id)}
              badge={f.id} badgeColor="rgba(251,113,133,0.5)" title={f.label} sub={f.sub}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"0.5rem"}}>
                {f.matches.map(m=>{
                  const hasResult = res[m.id]&&!isNaN(parseInt(res[m.id]?.home))&&!isNaN(parseInt(res[m.id]?.away));
                  const desig = getDesignadosForMatch(m, rsp.goleadoresDesignados, rsp.arquerosDesignados);
                  const hasDesig = desig.goleadores.length>0||desig.arqueros.length>0;
                  return (
                    <div key={m.id}>
                      <MatchCard match={m} scores={res} onScore={(id,side,v)=>setRes(p=>({...p,[id]:{...p[id],[side]:v}}))} isJoker={false} onJoker={null} jokersLeft={0} adminMode={true}/>
                      {hasResult&&hasDesig&&(
                        <div style={{marginTop:"0.35rem",padding:"0.4rem 0.5rem",background:"rgba(251,191,36,0.05)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:"0.5rem"}}>
                          <div style={{fontSize:"0.55rem",fontWeight:900,textTransform:"uppercase",color:"rgba(251,191,36,0.6)",marginBottom:"0.3rem"}}>⭐ Designados en este partido</div>
                          {desig.goleadores.map(player=>(
                            <div key={player} style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.25rem"}}>
                              <span style={{fontSize:"0.65rem"}}>👟</span>
                              <span style={{fontSize:"0.65rem",color:"white",fontWeight:700,flex:1}}>{player}</span>
                              <input type="number" min="0" max="20"
                                value={rsp.designadoEvents?.[m.id]?.goleadores?.[player]??rsp.goleadoresDesignados?.[player]??""}
                                onChange={e=>setRsp(p=>({...p,designadoEvents:{...p.designadoEvents,[m.id]:{...p.designadoEvents?.[m.id],goleadores:{...p.designadoEvents?.[m.id]?.goleadores,[player]:e.target.value}}}}))}
                                placeholder="goles"
                                style={{width:"3rem",height:"1.75rem",textAlign:"center",fontSize:"0.75rem",fontWeight:900,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"0.35rem",color:"white",outline:"none",fontFamily:FONT,WebkitAppearance:"none",MozAppearance:"textfield"}}/>
                              <span style={{fontSize:"0.55rem",color:"rgba(255,255,255,0.3)"}}>gol(es)</span>
                            </div>
                          ))}
                          {desig.arqueros.map(player=>(
                            <div key={player} style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.25rem"}}>
                              <span style={{fontSize:"0.65rem"}}>🧤</span>
                              <span style={{fontSize:"0.65rem",color:"white",fontWeight:700,flex:1}}>{player}</span>
                              <div style={{display:"flex",gap:"0.3rem",alignItems:"center"}}>
                                <button onClick={()=>setRsp(p=>({...p,designadoEvents:{...p.designadoEvents,[m.id]:{...p.designadoEvents?.[m.id],arqueros:{...p.designadoEvents?.[m.id]?.arqueros,[player]:true}}}}))}
                                  style={{...S.btn,padding:"0.2rem 0.5rem",fontSize:"0.6rem",fontWeight:900,
                                    background:rsp.designadoEvents?.[m.id]?.arqueros?.[player]===true?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.05)",
                                    border:`1px solid ${rsp.designadoEvents?.[m.id]?.arqueros?.[player]===true?"rgba(52,211,153,0.4)":"rgba(255,255,255,0.1)"}`,
                                    color:rsp.designadoEvents?.[m.id]?.arqueros?.[player]===true?"#34d399":"rgba(255,255,255,0.4)"}}>✓ Valla</button>
                                <button onClick={()=>setRsp(p=>({...p,designadoEvents:{...p.designadoEvents,[m.id]:{...p.designadoEvents?.[m.id],arqueros:{...p.designadoEvents?.[m.id]?.arqueros,[player]:false}}}}))}
                                  style={{...S.btn,padding:"0.2rem 0.5rem",fontSize:"0.6rem",fontWeight:900,
                                    background:rsp.designadoEvents?.[m.id]?.arqueros?.[player]===false?"rgba(251,113,133,0.2)":"rgba(255,255,255,0.05)",
                                    border:`1px solid ${rsp.designadoEvents?.[m.id]?.arqueros?.[player]===false?"rgba(251,113,133,0.4)":"rgba(255,255,255,0.1)"}`,
                                    color:rsp.designadoEvents?.[m.id]?.arqueros?.[player]===false?"#fb7185":"rgba(255,255,255,0.4)"}}>✗ Gol</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Accordion>
          ))}
          {hM&&<div style={{display:"flex",justifyContent:"center",padding:"0.75rem 0"}}>
            <button onClick={()=>setVis(c=>Math.min(c+PAGE_SIZE,FECHAS.length))} style={{...S.btn,padding:"0.6rem 1.25rem",background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:"0.75rem",textTransform:"uppercase",letterSpacing:"0.1em"}}>
              Ver más +{Math.min(PAGE_SIZE,rem)}
            </button>
          </div>}
        </div>
        <button onClick={save} style={{...S.btn,width:"100%",marginTop:"1rem",padding:"1rem",background:"linear-gradient(90deg,#f43f5e,#fb7185)",color:"white",fontSize:"0.875rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.1em"}}>
          {saved?"✓ Guardado":"Guardar Resultados"}
        </button>
      </div>
    </div>
  );
}

// --- KNOCKOUT BRACKET DATA ----------------------------------------------------
// Official FIFA 2026 Round of 32 crossings
// Each match: { id, slot, home: {type,group,pos}, away: {type,group,pos} }
// type: "W"=winner, "R"=runner-up, "T"=third (group TBD by 495 scenarios)
const R32_MATCHES = [
  // June 28
  {id:"r32_1",  label:"Partido 1",  home:{type:"R",group:"A"}, away:{type:"R",group:"B"}},
  // June 29
  {id:"r32_2",  label:"Partido 2",  home:{type:"W",group:"C"}, away:{type:"R",group:"F"}},
  {id:"r32_3",  label:"Partido 3",  home:{type:"W",group:"E"}, away:{type:"T",groups:["A","B","C","D","F"]}},
  {id:"r32_4",  label:"Partido 4",  home:{type:"W",group:"F"}, away:{type:"R",group:"C"}},
  // June 30
  {id:"r32_5",  label:"Partido 5",  home:{type:"R",group:"E"}, away:{type:"R",group:"I"}},
  {id:"r32_6",  label:"Partido 6",  home:{type:"W",group:"I"}, away:{type:"T",groups:["C","D","F","G","H"]}},
  {id:"r32_7",  label:"Partido 7",  home:{type:"W",group:"A"}, away:{type:"T",groups:["C","E","F","H","I"]}},
  // July 1
  {id:"r32_8",  label:"Partido 8",  home:{type:"W",group:"L"}, away:{type:"T",groups:["E","H","I","J","K"]}},
  {id:"r32_9",  label:"Partido 9",  home:{type:"W",group:"G"}, away:{type:"T",groups:["A","E","H","I","J"]}},
  {id:"r32_10", label:"Partido 10", home:{type:"W",group:"D"}, away:{type:"T",groups:["B","E","F","I","J"]}},
  // July 2
  {id:"r32_11", label:"Partido 11", home:{type:"W",group:"H"}, away:{type:"R",group:"J"}},
  {id:"r32_12", label:"Partido 12", home:{type:"R",group:"K"}, away:{type:"R",group:"L"}},
  {id:"r32_13", label:"Partido 13", home:{type:"W",group:"B"}, away:{type:"T",groups:["E","F","G","I","J"]}},
  // July 3
  {id:"r32_14", label:"Partido 14", home:{type:"R",group:"D"}, away:{type:"R",group:"G"}},
  {id:"r32_15", label:"Partido 15", home:{type:"W",group:"J"}, away:{type:"R",group:"H"}},
  {id:"r32_16", label:"Partido 16", home:{type:"W",group:"K"}, away:{type:"T",groups:["D","E","I","J","L"]}},
];

// Helper: resolve a slot to a team id given real group results
// FIFA 2026 Bracket progression
const BRACKET = {
  r16:[
    {id:"r16_1",home:"r32_1",away:"r32_2"},{id:"r16_2",home:"r32_3",away:"r32_4"},
    {id:"r16_3",home:"r32_5",away:"r32_6"},{id:"r16_4",home:"r32_7",away:"r32_8"},
    {id:"r16_5",home:"r32_9",away:"r32_10"},{id:"r16_6",home:"r32_11",away:"r32_12"},
    {id:"r16_7",home:"r32_13",away:"r32_14"},{id:"r16_8",home:"r32_15",away:"r32_16"},
  ],
  qf:[
    {id:"qf_1",home:"r16_1",away:"r16_2"},{id:"qf_2",home:"r16_3",away:"r16_4"},
    {id:"qf_3",home:"r16_5",away:"r16_6"},{id:"qf_4",home:"r16_7",away:"r16_8"},
  ],
  sf:[{id:"sf_1",home:"qf_1",away:"qf_2"},{id:"sf_2",home:"qf_3",away:"qf_4"}],
  third:[{id:"third_1",home:"sf_1",away:"sf_2",loser:true}],
  final:[{id:"final_1",home:"sf_1",away:"sf_2"}],
};

// Group knockout matches by date for accordion display
const KO_DATES = (() => {
  const groups = {};
  const allMatches = [
    ...R32_MATCHES.map(m=>({...m,round:"r32",roundLabel:"16avos",icon:"⚔️",color:"#a78bfa"})),
    ...BRACKET.r16.map((m,i)=>({id:m.id,home:m.home,away:m.away,label:`Partido ${i+1}`,round:"r16",roundLabel:"8avos",icon:"🥊",color:"#38bdf8"})),
    ...BRACKET.qf.map((m,i)=>({id:m.id,home:m.home,away:m.away,label:`Partido ${i+1}`,round:"qf",roundLabel:"Cuartos",icon:"🔥",color:"#f59e0b"})),
    ...BRACKET.sf.map((m,i)=>({id:m.id,home:m.home,away:m.away,label:`Partido ${i+1}`,round:"sf",roundLabel:"Semis",icon:"💥",color:"#fb7185"})),
    ...BRACKET.third.map((m,i)=>({id:m.id,home:m.home,away:m.away,label:"3° Puesto",round:"third",roundLabel:"3° Puesto",icon:"🥉",color:"#cd7f32",loser:true})),
    ...BRACKET.final.map((m,i)=>({id:m.id,home:m.home,away:m.away,label:"Final",round:"final",roundLabel:"Final",icon:"👑",color:"#fbbf24"})),
  ];
  allMatches.forEach(m=>{
    const ts = KO_KICKOFF[m.id];
    if(!ts) return;
    const d = new Date(ts-4*3600*1000); // BOT = UTC-4
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;
    const dias = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
    const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const label = `${dias[d.getUTCDay()]} ${d.getUTCDate()} de ${meses[d.getUTCMonth()]}`;
    if(!groups[key]) groups[key] = {label, matches:[]};
    const h=d.getUTCHours(),mi=d.getUTCMinutes();
    groups[key].matches.push({...m, time:`${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}`});
  });
  return Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,g])=>({date,label:g.label,matches:g.matches}));
})();

function resolveKOTeam(matchId, adminResults, r32Teams) {
  const r32=r32Teams.find(m=>m.id===matchId);
  if(r32){
    const res=adminResults?.[matchId];
    if(res){const h=parseInt(res.home),a=parseInt(res.away);if(!isNaN(h)&&!isNaN(a)&&h!==a)return h>a?r32.homeId:r32.awayId;}
    return null;
  }
  for(const matches of Object.values(BRACKET)){
    const m=matches.find(x=>x.id===matchId);
    if(m){
      const res=adminResults?.[matchId];
      if(res){const h=parseInt(res.home),a=parseInt(res.away);if(!isNaN(h)&&!isNaN(a)&&h!==a){return h>a?resolveKOTeam(m.home,adminResults,r32Teams):resolveKOTeam(m.away,adminResults,r32Teams);}}
      return null;
    }
  }
  return null;
}

// Resolve the LOSER of a match (for third place)
function resolveKOLoser(matchId, adminResults, r32Teams) {
  for(const matches of Object.values(BRACKET)){
    const m=matches.find(x=>x.id===matchId);
    if(m){
      const res=adminResults?.[matchId];
      if(res){const h=parseInt(res.home),a=parseInt(res.away);if(!isNaN(h)&&!isNaN(a)&&h!==a){return h>a?resolveKOTeam(m.away,adminResults,r32Teams):resolveKOTeam(m.home,adminResults,r32Teams);}}
      return null;
    }
  }
  return null;
}

function slotLabel(slot) {
  if(!slot) return "TBD";
  if(slot.type==="W") return `1° Grupo ${slot.group}`;
  if(slot.type==="R") return `2° Grupo ${slot.group}`;
  if(slot.type==="T") return "Mejor 3°";
  return "TBD";
}

function resolveSlot(slot, realRes, groupScores) {
  if(!slot) return null;
  // Only resolve from REAL results (admin loaded), never from user predictions
  if(!realRes?.scores || !Object.keys(realRes.scores).length) return null;
  if(slot.type==="W"||slot.type==="R") {
    const pos = slot.type==="W" ? 0 : 1;
    try {
      const table = computeTable(slot.group, realRes.scores);
      return table[pos]?.id || null;
    } catch(_){ return null; }
  }
  if(slot.type==="T") return realRes?.specials?.thirds?.[slot.groups?.join(",")]||null;
  return null;
}

// Knockout score input card
function KnockoutCard({matchId, home, away, homeLabel, awayLabel, fScores, onScore, isJoker, onJoker, jokersLeft, round, adminMode=false}) {
  const s = fScores[matchId]||{home:"",away:""};
  const h = parseInt(s.home), a = parseInt(s.away);
  const has = !isNaN(h)&&!isNaN(a);
  const res = !has?null:h>a?"home":a>h?"away":"draw";
  const homeT = home?T[home]:null;
  const awayT = away?T[away]:null;
  const locked = adminMode?false:isLocked(matchId);
  const canJoker = !locked&&(isJoker||jokersLeft>0);

  const resColor = res==="draw"?"rgba(96,165,250,0.12)":res==="home"?"rgba(52,211,153,0.1)":res==="away"?"rgba(251,113,133,0.1)":"transparent";

  return (
    <div style={{background:`linear-gradient(135deg,${resColor},rgba(255,255,255,0.05))`,border:`1px solid ${isJoker?"rgba(251,191,36,0.5)":C.border}`,borderRadius:"1rem",overflow:"hidden"}}>
      {/* Top strip */}
      <div style={{padding:"0.35rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem",borderBottom:`1px solid ${C.border}`}}>
        <span style={{fontSize:"0.6rem",fontWeight:900,background:"rgba(167,139,250,0.15)",color:C.violet,padding:"0.15rem 0.4rem",borderRadius:"0.3rem",letterSpacing:"0.08em"}}>{round}</span>
        <span style={{flex:1}}/>
        {onJoker&&(
          <button onClick={()=>canJoker&&onJoker(matchId)} disabled={!canJoker&&!isJoker}
            style={{...S.btn,display:"flex",alignItems:"center",gap:"0.2rem",padding:"0.15rem 0.4rem",fontSize:"0.6rem",fontWeight:900,
              background:isJoker?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.06)",
              color:isJoker?C.gold:"rgba(255,255,255,0.25)",
              border:`1px solid ${isJoker?"rgba(251,191,36,0.4)":"rgba(255,255,255,0.1)"}`,
              opacity:!canJoker&&!isJoker?0.4:1}}>
            🃏 x2
          </button>
        )}
      </div>
      {/* Teams */}
      <div style={{padding:"0.5rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.2rem",opacity:res==="away"?0.35:1}}>
          {homeT
            ? <><FlagImg team={homeT} size={32}/>
                <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
                  <span style={{fontSize:"0.8rem",fontWeight:900,color:"white"}}>{homeT.short}</span>
                  {res==="home"&&<span style={{fontSize:"0.5rem",fontWeight:900,padding:"0.1rem 0.3rem",borderRadius:"99px",background:"rgba(52,211,153,0.2)",color:C.emerald}}>GANA</span>}
                </div>
                <span style={{fontSize:"0.55rem",color:C.muted,textAlign:"center"}}>{homeT.name}</span></>
            : <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)",fontStyle:"italic",textAlign:"center"}}>Por definir</span>
          }
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem",flexShrink:0}}>
          {has&&res==="draw"&&<div style={{fontSize:"0.55rem",fontWeight:900,padding:"0.1rem 0.4rem",borderRadius:"99px",background:"rgba(96,165,250,0.2)",color:"#93c5fd"}}>EMPATE</div>}
          {!has&&isJoker&&<div style={{fontSize:"0.55rem",fontWeight:900,padding:"0.1rem 0.4rem",borderRadius:"99px",background:"rgba(251,191,36,0.15)",color:C.gold}}>🃏 x2</div>}
          <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <ScoreInput value={s.home} onChange={v=>onScore(matchId,"home",v)} disabled={locked||!homeT||!awayT}/>
            <span style={{color:"rgba(255,255,255,0.25)",fontWeight:900}}>–</span>
            <ScoreInput value={s.away} onChange={v=>onScore(matchId,"away",v)} disabled={locked||!homeT||!awayT}/>
          </div>
          {(!homeT||!awayT)&&<span style={{fontSize:"0.5rem",color:"rgba(255,255,255,0.25)"}}>Esperando resultados</span>}
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.2rem",opacity:res==="home"?0.35:1}}>
          {awayT
            ? <><FlagImg team={awayT} size={32}/>
                <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
                  <span style={{fontSize:"0.8rem",fontWeight:900,color:"white"}}>{awayT.short}</span>
                  {res==="away"&&<span style={{fontSize:"0.5rem",fontWeight:900,padding:"0.1rem 0.3rem",borderRadius:"99px",background:"rgba(52,211,153,0.2)",color:C.emerald}}>GANA</span>}
                </div>
                <span style={{fontSize:"0.55rem",color:C.muted,textAlign:"center"}}>{awayT.name}</span></>
            : <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)",fontStyle:"italic",textAlign:"center"}}>Por definir</span>
          }
        </div>
      </div>
    </div>
  );
}


// Helper: resolve a slot to a team id given real group results

function FasesFinales({fScores,setFScores,fJokers,setFJokers,scores,realRes,subRound,setSubRound,openF,setOpenF}) {
  // HOOKS FIRST - Rules of Hooks
  const [krRanking,setKrRanking] = useState([]);
  const [krLoaded,setKrLoaded]   = useState(false);
  const krReal = realRes?.knockoutResults||{};

  useEffect(()=>{
    if(!Object.keys(krReal).length) return;
    let alive=true;
    (async()=>{
      try{
        const allFSc = await sGetAllFScores();
        const rows=await Promise.all(Object.entries(allFSc).map(async ([un,ufs])=>{
          let hits=0;
          Object.entries(krReal).forEach(([mid,real])=>{
            const pred=ufs[mid];if(!pred)return;
            const rh=parseInt(real.home),ra=parseInt(real.away),ph=parseInt(pred.home),pa=parseInt(pred.away);
            if([rh,ra,ph,pa].some(isNaN))return;
            if((rh>ra?"H":rh<ra?"A":"D")===(ph>pa?"H":ph<pa?"A":"D"))hits++;
          });
          return{username:un,hits};
        }));
        rows.sort((a,b)=>b.hits-a.hits);
        if(alive){setKrRanking(rows);setKrLoaded(true);}
      }catch(_){}
    })();
    return()=>{alive=false;};
  },[JSON.stringify(krReal)]);

  // NON-HOOK VARS
  const jLeft=2-fJokers.length;
  const handleScore=(id,side,v)=>{ if(isLocked(id)) return; setFScores(p=>({...p,[id]:{...p[id],[side]:v}})); };
  const handleJoker=id=>setFJokers(p=>p.includes(id)?p.filter(x=>x!==id):p.length>=2?p:[...p,id]);
  const toggleRound=id=>setSubRound(p=>p===id?null:id);
  const r32Teams=R32_MATCHES.map(m=>({...m,homeId:resolveSlot(m.home,realRes,scores),awayId:resolveSlot(m.away,realRes,scores)}));
  const knockoutReal=realRes?.knockout||{};
  const ROUNDS=[
    {id:"r32",label:"16avos",icon:"⚔️",color:C.violet,count:16,dates:"28 Jun-3 Jul"},
    {id:"r16",label:"8avos",icon:"🥊",color:C.sky,count:8,dates:"4-8 Jul"},
    {id:"qf",label:"Cuartos",icon:"🔥",color:C.gold,count:4,dates:"9-10 Jul"},
    {id:"sf",label:"Semis",icon:"💥",color:C.rose,count:2,dates:"13-14 Jul"},
    {id:"third",label:"3° Puesto",icon:"🥉",color:"#cd7f32",count:1,dates:"18 Jul"},
    {id:"final",label:"Final",icon:"👑",color:"#fbbf24",count:1,dates:"19 Jul"},
  ];
  const podiumPts=[10,6,3];
  const podiumIcons=["🥇","🥈","🥉"];
  const podiumColors=[C.gold,"#94a3b8","#b45309"];

  return (
    <div>
      {/* Joker counter */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:"1.25rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.3rem 0.75rem",background:C.surface,border:`1px solid ${C.border}`,borderRadius:"99px"}}>
          <span>🃏</span>
          <span style={{fontWeight:900,fontSize:"0.75rem",color:jLeft>0?C.gold:C.muted}}>{jLeft} comodines restantes</span>
          <span style={{fontSize:"0.6rem",color:C.muted}}>(fase final)</span>
        </div>
      </div>

      {/* -- REY DE LLAVES PODIUM -- */}
      <div style={{maxWidth:"480px",margin:"0 auto 1.5rem"}}>
        <div style={{...S.card,padding:"1rem",border:`1px solid rgba(251,191,36,0.2)`,background:"rgba(251,191,36,0.04)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem"}}>
          <span style={{fontSize:"1.25rem"}}>👑</span>
          <div>
            <div style={{fontSize:"0.9rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em",color:C.gold}}>Rey de Llaves</div>
            <div style={{fontSize:"0.6rem",color:C.muted}}>Más aciertos de ganador en fase final · 🥇10pts · 🥈6pts · 🥉3pts</div>
          </div>
        </div>

        {!krLoaded || krRanking.length===0 ? (
          <div style={{textAlign:"center",padding:"1rem 0",color:C.muted,fontSize:"0.75rem"}}>
            {Object.keys(krReal).length===0
              ? "Disponible cuando haya resultados de fase final"
              : "Calculando..."}
          </div>
        ) : (
          <div style={{display:"flex",gap:"0.5rem",justifyContent:"center",flexWrap:"wrap"}}>
            {krRanking.slice(0,3).map((u,i)=>(
              <div key={u.username} style={{
                flex:1,minWidth:"80px",maxWidth:"160px",
                background:i===0?"rgba(251,191,36,0.12)":i===1?"rgba(148,163,184,0.1)":"rgba(180,83,9,0.1)",
                border:`1px solid ${i===0?"rgba(251,191,36,0.3)":i===1?"rgba(148,163,184,0.2)":"rgba(180,83,9,0.2)"}`,
                borderRadius:"1rem",padding:"0.75rem 0.5rem",textAlign:"center",
                order:i===0?1:i===1?0:2, // silver left, gold center, bronze right
              }}>
                <div style={{fontSize:i===0?"2rem":"1.5rem",marginBottom:"0.25rem"}}>{podiumIcons[i]}</div>
                <div style={{fontSize:"0.75rem",fontWeight:900,color:podiumColors[i],marginBottom:"0.15rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.username}</div>
                <div style={{fontSize:"0.85rem",fontWeight:900,color:"white"}}>{u.hits} <span style={{fontSize:"0.6rem",color:C.muted}}>aciertos</span></div>
                <div style={{fontSize:"0.7rem",fontWeight:900,color:podiumColors[i],marginTop:"0.15rem"}}>+{podiumPts[i]} pts</div>
              </div>
            ))}
          </div>
        )}
        </div>{/* end inner card */}
      </div>{/* end centered wrapper */}

      {/* Comodines finales */}
      <div style={{display:"inline-flex",alignItems:"center",gap:"0.35rem",padding:"0.2rem 0.55rem",background:jLeft>0?"rgba(167,139,250,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${jLeft>0?"rgba(167,139,250,0.25)":C.border}`,borderRadius:"99px",marginBottom:"0.75rem"}}>
        <span style={{fontSize:"0.8rem"}}>🃏</span>
        <span style={{fontWeight:900,fontSize:"0.68rem",color:jLeft>0?C.violet:C.muted}}>{jLeft} comodín{jLeft!==1?"es":""} · fase final</span>
      </div>

      {/* Dates accordion - same format as fase grupos */}
      <div style={{overflowY:"auto",maxHeight:"calc(100vh - 200px)",paddingRight:"2px",paddingBottom:"1rem"}}>
        {KO_DATES.map((fecha,fi)=>{
          const isOpen = openF===fecha.date;
          const adminResults = realRes?.knockoutResults||{};
          const r32t = R32_MATCHES.map(x=>({...x,homeId:resolveSlot(x.home,realRes,scores),awayId:resolveSlot(x.away,realRes,scores)}));
          const done = fecha.matches.filter(m=>{const s=fScores[m.id];return s&&!isNaN(parseInt(s.home))&&!isNaN(parseInt(s.away));}).length;
          const roundColors = {"r32":"#a78bfa","r16":"#38bdf8","qf":"#f59e0b","sf":"#fb7185","third":"#cd7f32","final":"#fbbf24"};
          return(
            <div key={fecha.date} style={{marginBottom:"0.4rem"}}>
              <button onClick={()=>setOpenF(p=>p===fecha.date?null:fecha.date)}
                style={{...S.btn,width:"100%",padding:"0.7rem 0.875rem",background:isOpen?"rgba(255,255,255,0.07)":"rgba(255,255,255,0.04)",border:`1px solid ${isOpen?"rgba(255,255,255,0.15)":"rgba(255,255,255,0.08)"}`,color:"white",display:"flex",alignItems:"center",gap:"0.5rem",borderRadius:"0.875rem",transition:"all 0.2s",textAlign:"left"}}>
                <div style={{width:"1.75rem",height:"1.75rem",borderRadius:"0.5rem",background:`rgba(${fecha.matches[0]?.round==="r32"?"167,139,250":fecha.matches[0]?.round==="r16"?"56,189,248":fecha.matches[0]?.round==="qf"?"251,191,36":fecha.matches[0]?.round==="sf"?"251,113,133":"251,191,36"},0.2)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.85rem",flexShrink:0}}>{fecha.matches[0]?.icon||"⚽"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:900,fontSize:"0.85rem",lineHeight:1.2}}>{fecha.matches[0]?.roundLabel} — {fecha.label}</div>
                  <div style={{fontSize:"0.6rem",color:C.muted,marginTop:"0.1rem"}}>{fecha.matches.map(m=>m.time).join(" · ")} BOT</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"0.4rem",flexShrink:0}}>
                  <span style={{fontSize:"0.65rem",color:done>0?C.gold:C.muted,fontWeight:done>0?700:400}}>{done}/{fecha.matches.length}</span>
                  <span style={{fontSize:"0.7rem",color:C.muted}}>{isOpen?"▲":"▼"}</span>
                </div>
              </button>
              {isOpen&&(
                <div style={{marginTop:"0.35rem",display:"flex",flexDirection:"column",gap:"0.35rem",paddingLeft:"0.25rem"}}>
                  {fecha.matches.map((m,mi)=>{
                    const homeId = m.round==="r32"?(r32t.find(x=>x.id===m.id)?.homeId||null):m.loser?resolveKOLoser(m.home,adminResults,r32t):resolveKOTeam(m.home,adminResults,r32t);
                    const awayId = m.round==="r32"?(r32t.find(x=>x.id===m.id)?.awayId||null):m.loser?resolveKOLoser(m.away,adminResults,r32t):resolveKOTeam(m.away,adminResults,r32t);
                    const homeLabel = m.round==="r32"?slotLabel(m.home):`G. P${mi+1}`;
                    const awayLabel = m.round==="r32"?slotLabel(m.away):`G. P${mi+2}`;
                    const hT=homeId?T[homeId]:null, aT=awayId?T[awayId]:null;
                    const s=fScores[m.id]||{};
                    const locked=isLocked(m.id);
                    return(
                      <div key={m.id} style={{background:"rgba(255,255,255,0.04)",border:`1px solid rgba(255,255,255,0.07)`,borderRadius:"0.75rem",padding:"0.5rem 0.75rem"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"0.25rem",marginBottom:"0.4rem"}}>
                          <span style={{fontSize:"0.55rem",fontWeight:900,background:`rgba(${roundColors[m.round]==="r32"?"167,139,250":""},0.15)`,color:roundColors[m.round]||C.violet,padding:"0.1rem 0.35rem",borderRadius:"0.3rem"}}>{m.roundLabel}</span>
                          <span style={{fontSize:"0.55rem",color:C.muted}}>P{mi+1} · {m.time} BOT</span>
                          {locked&&<span style={{fontSize:"0.55rem",color:C.rose,marginLeft:"auto"}}>🔒 Cerrado</span>}
                        </div>
                        <KnockoutCard matchId={m.id} home={homeId} away={awayId}
                          homeLabel={homeLabel} awayLabel={awayLabel}
                          fScores={fScores} onScore={handleScore}
                          isJoker={fJokers.includes(m.id)} onJoker={handleJoker} jokersLeft={jLeft}
                          round={m.roundLabel}/>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}


// --- RANKING MODAL ------------------------------------------------------------
function RankingModal({onClose, currentUser, realRes, inline=false}) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState(null);
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try {
        const rr = await sGetRealResults();
        const [allSc,allSp,allJk,allFSc,allFJk,approvedUsers] = await Promise.all([
          sGetAllScores(), sbFetch("specials?select=username,data"),
          sGetAllJokers(), sGetAllFScores(), sGetAllFJokers(), sGetApprovedUsers()
        ]);
        const spMap = {};(allSp||[]).forEach(r=>{spMap[r.username]=r.data||{};});
        // Fallback: use allSc keys if approvedUsers is empty
        const userList = approvedUsers?.length>0 ? approvedUsers.map(u=>u.username) : Object.keys(allSc);
        const users = userList.filter(u=>u!=="admin");
        const data=await Promise.all(users.map(async un=>{
          const sc=allSc[un]||{}, usp=spMap[un]||{}, jk=allJk[un]||[];
          const fsc=allFSc[un]||{}, fjk=allFJk[un]||[];

          // Phase groups points
          let grpPts=0,breakdown={};
          if(rr){
            const rObj=Object.fromEntries(ALL_MATCHES.map(m=>[m.id,rr.scores?.[m.id]]));
            const merged={...rObj,...rr.specials};
            try{const cp=calcPoints(sc,usp,merged,jk);grpPts=cp.total;breakdown=cp.breakdown||{};}catch(_){}
          }

          // Fases finales points (knockout results from real:knockout)
          const krReal=rr?.knockoutResults||{};
          let finPts=0;
          Object.entries(krReal).forEach(([mid,real])=>{
            const pred=fsc[mid]; if(!pred) return;
            let p=matchPts(pred,real);
            if(fjk.includes(mid)) p*=2;
            finPts+=p;
          });

          // Rey de Llaves bonus
          let krHits=0;
          Object.entries(krReal).forEach(([mid,real])=>{
            const pred=fsc[mid]; if(!pred) return;
            const rh=parseInt(real.home),ra=parseInt(real.away),ph=parseInt(pred.home),pa=parseInt(pred.away);
            if([rh,ra,ph,pa].some(isNaN)) return;
            if((rh>ra?"H":rh<ra?"A":"D")===(ph>pa?"H":ph<pa?"A":"D")) krHits++;
          });
          // Top 3 get bonus (calculated after sorting)
          const filled=ALL_MATCHES.filter(m=>{const s=sc[m.id];return s&&!isNaN(parseInt(s.home))&&!isNaN(parseInt(s.away));}).length;
          return {username:un, grpPts, finPts, krHits, filled, total:ALL_MATCHES.length, breakdown};
        }));

        // Apply Rey de Llaves bonus to top 3
        const sorted=[...data].sort((a,b)=>b.krHits-a.krHits);
        const krBonus=[10,6,3];
        sorted.forEach((r,i)=>{ if(i<3&&r.krHits>0) r.finPts+=krBonus[i]; });

        data.forEach(r=>{ r.totalPts=r.grpPts+r.finPts; });
        data.sort((a,b)=>b.totalPts-a.totalPts||b.filled-a.filled||a.username.localeCompare(b.username));
        if(alive) setRows(data);
      }catch(err){console.error('Ranking error:',err);if(alive)setError(String(err));}
      if(alive) setLoading(false);
    })();
    return()=>{alive=false;};
  },[refreshTick]);

  // Auto-refresh every 30 seconds
  useEffect(()=>{
    const t = setInterval(()=>setRefreshTick(p=>p+1), 30000);
    return()=>clearInterval(t);
  },[]);

  const icons=["🥇","🥈","🥉"], podCol=[C.gold,"#94a3b8","#b45309"];
  const br=`1px solid ${C.border}`;

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1rem",paddingTop:"4rem"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)"}}/>
      <div style={{position:"relative",width:"100%",maxWidth:"600px",maxHeight:"82vh",display:"flex",flexDirection:"column",background:"#0d1f0d",border:br,borderRadius:"1.25rem",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>

        {/* Header */}
        <div style={{padding:"0.875rem 1rem",borderBottom:br,display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
          <span style={{fontSize:"1.25rem"}}>🏅</span>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.9rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em",color:C.violet}}>Ranking General</div>
            <div style={{fontSize:"0.6rem",color:C.muted}}>Fase de grupos + Fases finales + Rey de Llaves</div>
          </div>
          <button onClick={onClose} style={{...S.btn,width:"1.5rem",height:"1.5rem",borderRadius:"50%",background:"rgba(255,255,255,0.08)",color:C.muted,border:"none",fontSize:"0.85rem"}}>✕</button>
        </div>

        {loading ? (
          <div style={{padding:"3rem",textAlign:"center",color:C.muted,fontWeight:900,fontSize:"0.75rem",textTransform:"uppercase"}}>Cargando...</div>
        ) : error ? (
          <div style={{padding:"2rem",textAlign:"center"}}><div style={{fontSize:"0.7rem",color:"#fb7185",wordBreak:"break-all"}}>{error}</div><button onClick={()=>{setError(null);setRefreshTick(p=>p+1);}} style={{...S.btn,marginTop:"1rem",padding:"0.4rem 1rem",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",color:"white",fontSize:"0.7rem"}}>Reintentar</button></div>
        ) : rows.length===0 ? (
          <div style={{padding:"3rem",textAlign:"center"}}><div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>👥</div><div style={{color:C.muted,fontSize:"0.75rem",fontWeight:900,textTransform:"uppercase"}}>Sin usuarios</div><button onClick={()=>setRefreshTick(p=>p+1)} style={{...S.btn,marginTop:"1rem",padding:"0.4rem 1rem",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",color:"white",fontSize:"0.7rem"}}>Actualizar</button></div>
        ) : (
          <>
            {/* Column headers */}
            <div style={{display:"grid",gridTemplateColumns:"2rem 1fr 5rem 5rem 5rem",gap:"0.25rem",padding:"0.4rem 0.75rem",background:"rgba(255,255,255,0.05)",borderBottom:br,flexShrink:0}}>
              {["#","Usuario","Grupos","Finales","Total"].map((h,i)=>(
                <span key={i} style={{fontSize:"0.55rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.08em",
                  color:i===4?C.gold:i===3?C.violet:i===2?"rgba(251,191,36,0.6)":C.muted,textAlign:i===0?"left":"center"}}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div style={{overflowY:"auto",flex:1}}>
              {rows.map((r,i)=>{
                const isMe=r.username===currentUser;
                const pct=Math.round((r.filled/r.total)*100);
                return (
                  <div key={r.username} style={{borderTop:br,background:isMe?"rgba(167,139,250,0.07)":i%2===0?"transparent":"rgba(255,255,255,0.015)"}}>
                  <div style={{display:"grid",gridTemplateColumns:"2rem 1fr 5rem 5rem 5rem",gap:"0.25rem",padding:"0.55rem 0.75rem",alignItems:"center"}}>
                    {/* Rank */}
                    <div>{i<3?<span style={{fontSize:"1rem"}}>{icons[i]}</span>:<span style={{fontSize:"0.7rem",fontWeight:900,color:C.muted}}>{i+1}</span>}</div>
                    {/* User */}
                    <div style={{minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"0.35rem"}}>
                        <div style={{width:"1.3rem",height:"1.3rem",borderRadius:"0.3rem",background:isMe?"rgba(167,139,250,0.25)":"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:900,color:isMe?C.violet:C.muted,flexShrink:0}}>{r.username[0].toUpperCase()}</div>
                        <span style={{fontSize:"0.78rem",fontWeight:700,color:isMe?C.violet:"rgba(255,255,255,0.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.username}{isMe&&<span style={{color:C.violet,fontSize:"0.55rem"}}> ★</span>}</span>
                      </div>
                      <div style={{marginTop:"0.2rem",display:"flex",alignItems:"center",gap:"0.25rem"}}>
                        <div style={{flex:1,height:"3px",background:"rgba(255,255,255,0.08)",borderRadius:"99px",overflow:"hidden"}}><div style={{height:"100%",background:`linear-gradient(90deg,${C.gold},${C.goldL})`,width:`${pct}%`}}/></div>
                        <span style={{fontSize:"0.5rem",color:C.muted}}>{pct}%</span>
                      </div>
                    </div>
                    {/* Grupos pts */}
                    <div style={{textAlign:"center"}}>
                      <span style={{fontSize:"0.82rem",fontWeight:900,color:"rgba(251,191,36,0.8)"}}>{r.grpPts}</span>
                      <span style={{fontSize:"0.55rem",color:C.muted}}> pts</span>
                    </div>
                    {/* Finales pts */}
                    <div style={{textAlign:"center"}}>
                      <span style={{fontSize:"0.82rem",fontWeight:900,color:r.finPts>0?C.violet:"rgba(255,255,255,0.25)"}}>{r.finPts}</span>
                      <span style={{fontSize:"0.55rem",color:C.muted}}> pts</span>
                    </div>
                    {/* Total — clickable for breakdown */}
                    <div style={{textAlign:"center"}}>
                      <div onClick={()=>setSelectedUser(selectedUser?.username===r.username?null:r)}
                        style={{display:"inline-flex",flexDirection:"column",alignItems:"center",padding:"0.2rem 0.5rem",borderRadius:"0.6rem",cursor:"pointer",
                        background:i===0?"rgba(251,191,36,0.15)":i===1?"rgba(148,163,184,0.1)":i===2?"rgba(180,83,9,0.1)":isMe?"rgba(167,139,250,0.1)":"rgba(255,255,255,0.05)",
                        border:`1px solid ${i===0?"rgba(251,191,36,0.25)":i===1?"rgba(148,163,184,0.15)":i===2?"rgba(180,83,9,0.15)":isMe?"rgba(167,139,250,0.2)":"rgba(255,255,255,0.07)"}`}}>
                        <span style={{fontSize:"0.9rem",fontWeight:900,color:i<3?podCol[i]:isMe?C.violet:"rgba(255,255,255,0.7)",lineHeight:1}}>{r.totalPts}</span>
                        <span style={{fontSize:"0.5rem",color:C.muted,lineHeight:1.2}}>pts ▾</span>
                      </div>
                    </div>
                  </div>{/* end grid row */}
                    {/* Breakdown row */}
                    {selectedUser?.username===r.username && (
                      <div style={{gridColumn:"1/-1",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(255,255,255,0.08)`,borderRadius:"0.6rem",padding:"0.6rem 0.75rem",marginTop:"0.25rem",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:"0.4rem"}}>
                        {[
                          {label:"⚽ Partidos", val:r.grpPts, color:"rgba(251,191,36,0.8)"},
                          {label:"🏆 Campeón", val:r.breakdown?.campeon||0, color:C.gold},
                          {label:"🥈 Subcampeón", val:r.breakdown?.subcampeon||0, color:"#94a3b8"},
                          {label:"👟 Goleador", val:r.breakdown?.goleador||0, color:C.emerald},
                          {label:`👟 ${r.breakdown?.goleadorDesignadoName||"Designado"}`, val:r.breakdown?.goleadorDesignado||0, color:"#fb7185"},
                          {label:`🧤 ${r.breakdown?.arqueroDesignadoName||"Arquero"}`, val:r.breakdown?.arqueroDesignado||0, color:C.sky},
                          {label:"🎯 Clasificados", val:r.breakdown?.clasificados||0, color:C.violet},
                          {label:"🏅 Finales", val:r.finPts||0, color:C.violet},
                          {label:"👑 Rey Llaves", val:r.krHits||0, color:C.gold},
                        ].map(({label,val,color})=>(
                          <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0.2rem 0.4rem",background:"rgba(255,255,255,0.03)",borderRadius:"0.4rem"}}>
                            <span style={{fontSize:"0.58rem",color:"rgba(255,255,255,0.5)"}}>{label}</span>
                            <span style={{fontSize:"0.72rem",fontWeight:900,color:val>0?color:"rgba(255,255,255,0.2)"}}>{val} pts</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Refresh */}
            <div style={{display:"flex",justifyContent:"center",padding:"0.6rem",borderTop:br,flexShrink:0}}>
              <button onClick={()=>setRefreshTick(p=>p+1)} style={{...S.btn,display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.4rem 0.875rem",background:"rgba(255,255,255,0.05)",border:br,color:C.muted,fontSize:"0.65rem",textTransform:"uppercase",letterSpacing:"0.1em"}}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Actualizar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- MURO DE PRONÓSTICOS ------------------------------------------------------
function MuroModal({onClose,muroIdx,setMuroIdx,currentUser,inline=false}) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [refreshTick,setRefreshTick]=useState(0);

  const allM=ALL_MATCHES, locked=allM.filter(m=>isLocked(m.id)), anyLocked=locked.length>0;
  const nav=anyLocked?locked:allM;
  const idx=Math.min(muroIdx,nav.length-1);
  const m=nav[idx], hT=m?T[m.home]:null, aT=m?T[m.away]:null;
  const mLocked=m?isLocked(m.id):false;
  const real=data?.rr?.scores?.[m?.id];

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const [rr,sc,jk,spRaw] = await Promise.all([sGetRealResults(), sGetAllScores(), sGetAllJokers(), sbFetch('specials?select=username,data')]);
        const sp={}; (spRaw||[]).forEach(r=>{sp[r.username]=r.data||{};});
        if(alive)setData({sc,jk,rr,sp});
      }catch(_){}
      if(alive)setLoading(false);
    })();
    return()=>{alive=false;};
  },[refreshTick]);

  // Auto-refresh every 20 seconds
  useEffect(()=>{
    const t = setInterval(()=>setRefreshTick(p=>p+1), 20000);
    return()=>clearInterval(t);
  },[]);

  const goTo=i=>setMuroIdx(Math.max(0,Math.min(i,nav.length-1)));
  const users=data?Object.keys(data.sc).sort():[];
  const vis=mLocked?users:(users.includes(currentUser)?[currentUser]:[]);

  const bg="#0d1f0d", br=`1px solid ${C.border}`;
  const hdr={fontSize:"0.55rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.08em"};
  const grid={display:"grid",gridTemplateColumns:"1fr 4.5rem 4rem 3rem 4rem",gap:"0.25rem"};

  return (
    <div style={{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1rem",paddingTop:"4rem"}}>
      <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(4px)"}}/>
      <div style={{position:"relative",width:"100%",maxWidth:"640px",maxHeight:"82vh",display:"flex",flexDirection:"column",background:bg,border:br,borderRadius:"1.25rem",overflow:"hidden",boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}}>

        {/* Header */}
        <div style={{padding:"0.75rem 1rem",borderBottom:br,display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
          <span>👁️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.85rem",fontWeight:900,textTransform:"uppercase",color:C.emerald}}>Muro de Pronósticos</div>
            <div style={{fontSize:"0.6rem",color:C.muted}}>{anyLocked?`🔒 ${locked.length} cerrado${locked.length!==1?"s":""} · todos visibles`:"👤 Tus pronósticos · otros se revelan al cerrar"}</div>
          </div>
          <button onClick={onClose} style={{...S.btn,width:"1.5rem",height:"1.5rem",borderRadius:"50%",background:"rgba(255,255,255,0.08)",color:C.muted,border:"none",fontSize:"0.85rem"}}>✕</button>
        </div>

        {loading?<div style={{padding:"3rem",textAlign:"center",color:C.muted,fontWeight:900,fontSize:"0.75rem",textTransform:"uppercase"}}>Cargando...</div>:(
          <>
            {/* Navigator */}
            <div style={{padding:"0.6rem 1rem",borderBottom:br,display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
              <button onClick={()=>goTo(idx-1)} disabled={idx===0} style={{...S.btn,width:"1.75rem",height:"1.75rem",borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:br,color:C.muted,fontSize:"1rem",opacity:idx===0?0.3:1}}>‹</button>
              <div style={{flex:1,textAlign:"center"}}>
                {hT&&aT&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
                  <FlagImg team={hT} size={20}/>
                  <span style={{fontSize:"0.8rem",fontWeight:900,color:"white"}}>{hT.short}</span>
                  <span style={{fontSize:"0.65rem",color:C.muted}}>vs</span>
                  <span style={{fontSize:"0.8rem",fontWeight:900,color:"white"}}>{aT.short}</span>
                  <FlagImg team={aT} size={20}/>
                </div>}
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"0.35rem",marginTop:"0.1rem"}}>
                  <span style={{fontSize:"0.6rem",color:C.muted}}>{m?.time} BOT · GRP {m?.group} · {idx+1}/{nav.length}</span>
                  <span style={{...hdr,padding:"0.1rem 0.3rem",borderRadius:"99px",background:mLocked?"rgba(251,113,133,0.15)":"rgba(52,211,153,0.15)",color:mLocked?C.rose:C.emerald}}>{mLocked?"🔒":"✏️"}</span>
                  {real&&<span style={{fontSize:"0.6rem",color:C.gold,fontWeight:900}}>Real:{real.home}–{real.away}</span>}
                </div>
              </div>
              <button onClick={()=>goTo(idx+1)} disabled={idx===nav.length-1} style={{...S.btn,width:"1.75rem",height:"1.75rem",borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:br,color:C.muted,fontSize:"1rem",opacity:idx===nav.length-1?0.3:1}}>›</button>
            </div>

            {/* Table */}
            <div style={{overflowY:"auto",flex:1}}>
              <div style={{...grid,padding:"0.4rem 0.75rem",background:"rgba(255,255,255,0.05)",borderBottom:br,position:"sticky",top:0}}>
                {["Usuario","Partido","Score","🃏","Pts"].map((h,i)=>(
                  <span key={i} style={{...hdr,color:i===4?C.gold:C.muted,textAlign:i===0?"left":"center"}}>{h}</span>
                ))}
              </div>
              {vis.length===0?<div style={{padding:"2rem",textAlign:"center",color:C.muted,fontSize:"0.75rem"}}>Sin pronósticos</div>
              :vis.map((un,i)=>{
                const pred=data.sc[un]?.[m?.id], jks=data.jk[un]||[], isJok=jks.includes(m?.id);
                const h=pred?.home,a=pred?.away, has=h!==undefined&&h!==""&&a!==undefined&&a!==""&&!isNaN(+h)&&!isNaN(+a);
                const res=has?(+h>+a?"home":+h<+a?"away":"draw"):null;
                let pts=null; if(has&&real){pts=matchPts(pred,real);if(isJok)pts*=2;}
                const isMe=un===currentUser;
                return (
                  <div key={un} style={{...grid,padding:"0.45rem 0.75rem",borderTop:br,background:isMe?"rgba(52,211,153,0.05)":i%2===0?"transparent":"rgba(255,255,255,0.02)",alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.35rem",minWidth:0}}>
                      <div style={{width:"1.2rem",height:"1.2rem",borderRadius:"0.3rem",background:isMe?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.55rem",fontWeight:900,color:isMe?C.emerald:C.muted,flexShrink:0}}>{un[0].toUpperCase()}</div>
                      <span style={{fontSize:"0.75rem",fontWeight:700,color:isMe?C.emerald:"rgba(255,255,255,0.85)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{un}{isMe&&<span style={{color:C.emerald,fontSize:"0.55rem"}}> ★</span>}</span>
                    </div>
                    <div style={{textAlign:"center",fontSize:"0.6rem",color:C.muted}}>{hT?.short} vs {aT?.short}</div>
                    <div style={{textAlign:"center"}}>
                      {has?<span style={{fontSize:"0.82rem",fontWeight:900,color:res==="draw"?"#93c5fd":res==="home"?C.emerald:C.rose,background:res==="draw"?"rgba(96,165,250,0.12)":res==="home"?"rgba(52,211,153,0.12)":"rgba(251,113,133,0.12)",padding:"0.1rem 0.4rem",borderRadius:"0.4rem"}}>{h}–{a}</span>
                      :<span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.2)"}}>—</span>}
                    </div>
                    <div style={{textAlign:"center",fontSize:"0.85rem"}}>{isJok?"🃏":<span style={{color:"rgba(255,255,255,0.15)",fontSize:"0.55rem"}}>—</span>}</div>
                    <div style={{textAlign:"center"}}>
                      {pts!==null?<span style={{fontSize:"0.82rem",fontWeight:900,color:pts>0?C.gold:"rgba(255,255,255,0.3)",background:pts>0?"rgba(251,191,36,0.12)":"transparent",padding:"0.1rem 0.35rem",borderRadius:"0.35rem"}}>{pts>0?`+${pts}`:0}</span>
                      :<span style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.2)"}}>—</span>}
                    </div>
                  </div>
                );
              })}
              {!mLocked&&<div style={{padding:"0.6rem",textAlign:"center",borderTop:br}}>
                <span style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.2)"}}>🔒 Los demás pronósticos se revelan al cerrar este partido</span>
              </div>}

              {/* Designado Events for this match */}
              {mLocked&&data?.rr?.specials?.designadoEvents?.[m?.id]&&(()=>{
                const ev = data.rr.specials.designadoEvents[m.id];
                const gdMap = data.rr.specials?.goleadoresDesignados||{};
                const aqMap = data.rr.specials?.arquerosDesignados||{};
                const spMap = data.sp||{};
                const rows = [];

                // Goleadores
                Object.entries(ev.goleadores||{}).forEach(([player, goals])=>{
                  const g = parseInt(goals)||0;
                  if(g<=0) return;
                  const affected = Object.entries(spMap).filter(([,sp])=>sp?.goleadorDesignado?.trim().toLowerCase()===player.trim().toLowerCase());
                  affected.forEach(([un])=>{
                    rows.push({type:"gol", user:un, player, value:g, icon:"👟", color:"#fb7185"});
                  });
                });

                // Arqueros
                Object.entries(ev.arqueros||{}).forEach(([player, cleanSheet])=>{
                  if(!cleanSheet) return;
                  const affected = Object.entries(spMap).filter(([,sp])=>sp?.arqueroDesignado?.trim().toLowerCase()===player.trim().toLowerCase());
                  affected.forEach(([un])=>{
                    rows.push({type:"valla", user:un, player, value:1, icon:"🧤", color:C.sky});
                  });
                });

                if(rows.length===0) return null;
                return (
                  <div style={{borderTop:`1px solid rgba(251,191,36,0.15)`,padding:"0.5rem 0.75rem",background:"rgba(251,191,36,0.03)"}}>
                    <div style={{fontSize:"0.55rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.08em",color:"rgba(251,191,36,0.5)",marginBottom:"0.35rem"}}>⭐ Puntos por Designados</div>
                    {rows.map((r,i)=>{
                      const isMe = r.user===currentUser;
                      return (
                        <div key={i} style={{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.2rem 0",borderTop:i>0?`1px solid rgba(255,255,255,0.04)`:"none"}}>
                          <span style={{fontSize:"0.75rem"}}>{r.icon}</span>
                          <div style={{width:"1.2rem",height:"1.2rem",borderRadius:"0.3rem",background:isMe?"rgba(52,211,153,0.2)":"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.55rem",fontWeight:900,color:isMe?C.emerald:C.muted,flexShrink:0}}>{r.user[0].toUpperCase()}</div>
                          <span style={{fontSize:"0.7rem",fontWeight:700,color:isMe?C.emerald:"rgba(255,255,255,0.8)",flex:1}}>{r.user}{isMe&&<span style={{color:C.emerald,fontSize:"0.55rem"}}> ★</span>}</span>
                          <span style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.4)"}}>{r.player}</span>
                          <span style={{fontSize:"0.75rem",fontWeight:900,color:r.color,background:r.type==="valla"?"rgba(56,189,248,0.12)":"rgba(251,113,133,0.12)",padding:"0.1rem 0.35rem",borderRadius:"0.3rem"}}>+{r.value}pt{r.value!==1?"s":""}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Dots */}
            {nav.length>1&&<div style={{padding:"0.5rem",borderTop:br,display:"flex",justifyContent:"center",gap:"0.25rem",flexWrap:"wrap",flexShrink:0}}>
              {nav.map((_,i)=><button key={i} onClick={()=>setMuroIdx(i)} style={{...S.btn,width:i===idx?"1.25rem":"0.45rem",height:"0.45rem",borderRadius:"99px",padding:0,border:"none",background:i===idx?C.emerald:isLocked(nav[i]?.id)?"rgba(251,113,133,0.4)":"rgba(255,255,255,0.15)",transition:"all 0.2s"}}/>)}
            </div>}
          </>
        )}
      </div>
    </div>
  );
}

// --- RULES MODAL --------------------------------------------------------------
function RulesModal({onClose,inline=false}) {
  const bo = `1px solid ${C.border}`;
  const Section = ({icon,title,children}) => (
    <div style={{marginBottom:"1.25rem"}}>
      <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.5rem"}}>
        <span style={{fontSize:"1.1rem"}}>{icon}</span>
        <span style={{fontSize:"0.85rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em",color:"white"}}>{title}</span>
      </div>
      <div style={{paddingLeft:"1.6rem"}}>{children}</div>
    </div>
  );
  const Row = ({label,value,color}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.35rem 0",borderBottom:bo}}>
      <span style={{fontSize:"0.78rem",color:C.muted}}>{label}</span>
      <span style={{fontSize:"0.78rem",fontWeight:900,color:color||C.gold}}>{value}</span>
    </div>
  );
  return (
    <div style={inline?{}:{position:"fixed",inset:0,zIndex:2000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"1rem",paddingTop:"3rem"}}>
      {!inline&&<div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)"}}/>}
      <div style={{position:"relative",width:"100%",maxWidth:inline?"100%":"540px",maxHeight:inline?"calc(100vh - 180px)":"86vh",display:"flex",flexDirection:"column",background:"#0a1a0a",border:`1px solid ${C.sky}40`,borderRadius:inline?"1rem":"1.25rem",overflow:"hidden"}}>

        {/* Header */}
        <div style={{padding:"0.875rem 1rem",borderBottom:bo,display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0,background:"rgba(56,189,248,0.06)"}}>
          <span style={{fontSize:"1.25rem"}}>📋</span>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.95rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em",color:C.sky}}>Reglas del Prode Elite</div>
            <div style={{fontSize:"0.6rem",color:C.muted}}>Prode Elite · Mundial 2026 · USA · México · Canadá</div>
          </div>
          <button onClick={onClose} style={{...S.btn,width:"1.5rem",height:"1.5rem",borderRadius:"50%",background:"rgba(255,255,255,0.08)",color:C.muted,border:"none",fontSize:"0.85rem"}}>✕</button>
        </div>

        {/* Content */}
        <div style={{overflowY:"auto",flex:1,padding:"1rem"}}>

          <Section icon="⚽" title="Puntuación por Partido">
            <Row label="Resultado exacto (ej: 2-1 acertado)" value="+3 pts"/>
            <Row label="Ganador / Empate correcto" value="+3 pts"/>
            <Row label="Goles del local acertados" value="+1 pt"/>
            <Row label="Goles del visitante acertados" value="+1 pt"/>
            <div style={{marginTop:"0.5rem",padding:"0.4rem 0.6rem",background:"rgba(251,191,36,0.08)",border:`1px solid rgba(251,191,36,0.2)`,borderRadius:"0.5rem"}}>
              <span style={{fontSize:"0.72rem",color:C.gold,fontWeight:700}}>Máximo por partido: 8 pts · Con comodín 🃏: hasta 16 pts</span>
            </div>
          </Section>

          <Section icon="🃏" title="Comodines">
            <div style={{fontSize:"0.78rem",color:C.muted,lineHeight:1.6}}>
              Cada usuario tiene <span style={{color:"white",fontWeight:900}}>2 comodines por fase</span> (Fase Grupos y Fases Finales son independientes — no se acumulan).<br/>
              Al activar un comodín en un partido, <span style={{color:C.gold,fontWeight:900}}>los puntos obtenidos se duplican</span>.
            </div>
          </Section>

          <Section icon="⭐" title="Pronósticos Especiales">
            <Row label="Campeón del Mundial" value="+10 pts"/>
            <Row label="Subcampeón" value="+7 pts"/>
            <Row label="Goleador del torneo" value="+10 pts"/>
            <Row label="Goleador Designado" value="+1 pt por gol"/>
            <Row label="Arquero Designado" value="+1 pt por arco en 0"/>
          </Section>

          <Section icon="🎯" title="Clasificados a 16avos">
            <div style={{fontSize:"0.78rem",color:C.muted,lineHeight:1.6,marginBottom:"0.5rem"}}>
              Elegís hasta <span style={{color:"white",fontWeight:900}}>3 equipos por grupo</span> (máximo 32 en total, 8 terceros máximo).
            </div>
            <Row label="1° y 2° de grupo acertados" value="+1 pt c/u"/>
            <Row label="Mejor tercero acertado" value="+2 pts"/>
          </Section>

          <Section icon="🏆" title="Fases Finales">
            <div style={{fontSize:"0.78rem",color:C.muted,lineHeight:1.6,marginBottom:"0.5rem"}}>
              El sistema de puntuación es el mismo que en fase de grupos.<br/>
              <span style={{color:C.rose,fontWeight:700}}>Solo se cuentan los 90 minutos + alargue. Los penales NO suman.</span>
            </div>
            <Row label="16avos · 8avos · Cuartos · Semis · Final" value="Mismo sistema"/>
          </Section>

          <Section icon="👑" title="Rey de Llaves">
            <div style={{fontSize:"0.78rem",color:C.muted,lineHeight:1.6,marginBottom:"0.5rem"}}>
              Se cuenta quién acertó más <span style={{color:"white",fontWeight:900}}>resultados (ganador)</span> en toda la fase final.
            </div>
            <Row label="🥇 Mayor cantidad de aciertos" value="+10 pts" color={C.gold}/>
            <Row label="🥈 Segundo lugar" value="+6 pts" color="#94a3b8"/>
            <Row label="🥉 Tercer lugar" value="+3 pts" color="#b45309"/>
          </Section>

          <Section icon="🔒" title="Cierre de Pronósticos">
            <div style={{fontSize:"0.78rem",color:C.muted,lineHeight:1.6}}>
              Cada partido se bloquea automáticamente <span style={{color:C.rose,fontWeight:700}}>10 minutos antes del kickoff</span> (hora boliviana BOT, UTC-4).<br/>
              Una vez cerrado, no se puede modificar el pronóstico.<br/>
              El <span style={{color:"white",fontWeight:700}}>Muro de Pronósticos 👁️</span> se activa cuando se cierra el primer partido — podés ver los pronósticos de todos los jugadores.
            </div>
          </Section>

          <div style={{padding:"0.75rem",background:"rgba(56,189,248,0.06)",border:`1px solid rgba(56,189,248,0.2)`,borderRadius:"0.75rem",marginTop:"0.5rem"}}>
            <div style={{fontSize:"0.72rem",color:C.sky,fontWeight:700,marginBottom:"0.25rem"}}>💡 Tip</div>
            <div style={{fontSize:"0.72rem",color:C.muted,lineHeight:1.5}}>
              Usá tus comodines en partidos donde estés muy seguro del resultado — podés ganar hasta 16 puntos en un solo partido.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- LOGIN --------------------------------------------------------------------
function Login({onLogin}) {
  const [nombre,setNombre]     = useState("");
  const [apellido,setApellido] = useState("");
  const [u,setU]               = useState("");
  const [p,setP]               = useState("");
  const [err,setErr]           = useState("");
  const [loading,setL]         = useState(false);

  const submit=async()=>{
    const un=u.trim().toLowerCase(), pw=p.trim();
    const fn=(nombre.trim()+" "+apellido.trim()).trim();
    if(!un||!pw){setErr("Completá usuario y contraseña.");return;}
    if(pw.length<3){setErr("Contraseña mínimo 3 caracteres.");return;}
    setL(true);setErr("");
    try {
      const ex = await sGetUser(un);
      if(ex){
        if(ex.password!==pw){setErr("Contraseña incorrecta.");setL(false);return;}
        if(!ex.approved && un !== "admin"){setErr("Tu cuenta está pendiente de aprobación. El admin te habilitará pronto. ⏳");setL(false);return;}
      } else {
        if(!nombre.trim()||!apellido.trim()){setErr("Ingresá tu nombre y apellido para registrarte.");setL(false);return;}
        await sSetUser(un, pw, fn);
        setErr(""); setL(false);
        // Show pending message
        setErr("✅ Cuenta creada. Esperá la aprobación del admin para ingresar. ⏳");
        return;
      }
      const [sc,sp,jk,fsc,fjk] = await Promise.all([
        sGetScores(un), sGetSpecials(un), sGetJokers(un),
        sGetFScores(un), sGetFJokers(un)
      ]);
      onLogin(un, ex?.full_name||fn, sc, sp, jk, fsc, fjk);
    } catch(e){console.error(e);setErr("Error de conexión. Intentá de nuevo.");}
    setL(false);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",fontFamily:FONT,position:"relative",WebkitFontSmoothing:"antialiased"}}>
      <GrassBg/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:"360px"}}>
        <div style={{textAlign:"center",marginBottom:"2rem",color:"white"}}>
          <div style={{fontSize:"2rem"}}>⚽ 🏆</div>
          <h1 style={{fontSize:"clamp(2rem,8vw,3rem)",fontWeight:900,margin:"0.5rem 0",letterSpacing:"-1px",lineHeight:1}}>
            PRODE <span style={{background:`linear-gradient(90deg,${C.gold},${C.goldL})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ELITE</span>
          </h1>
          <div style={{fontSize:"clamp(2.5rem,10vw,4rem)",fontWeight:900,background:`linear-gradient(90deg,${C.amber},#fff,${C.amber})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>MUNDIAL 2026</div>
          <p style={{color:C.muted,fontSize:"0.75rem",letterSpacing:"0.2em",marginTop:"0.5rem"}}>USA · MÉXICO · CANADÁ</p>
        </div>
        <div style={{...S.card,padding:"1.5rem",backdropFilter:"blur(10px)"}}>
          <h2 style={{color:"rgba(255,255,255,0.8)",fontSize:"1.25rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.25rem"}}>Ingresar</h2>
          <p style={{color:C.muted,fontSize:"0.7rem",marginBottom:"1.25rem"}}>Completá todos los campos. Si ya tenés cuenta, nombre y apellido se ignoran.</p>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginBottom:"0.75rem"}}>
            <div>
              <label style={S.label}>Nombre</label>
              <input type="text" value={nombre} onChange={e=>{setNombre(e.target.value);setErr("");}} placeholder="Nombre" style={S.input}/>
            </div>
            <div>
              <label style={S.label}>Apellido</label>
              <input type="text" value={apellido} onChange={e=>{setApellido(e.target.value);setErr("");}} placeholder="Apellido" style={S.input}/>
            </div>
          </div>

          <div style={{marginBottom:"0.75rem"}}>
            <label style={S.label}>Usuario</label>
            <input type="text" value={u} onChange={e=>{setU(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="Tu nombre de usuario" style={S.input}/>
          </div>
          <div style={{marginBottom:"1rem"}}>
            <label style={S.label}>Contraseña</label>
            <input type="password" value={p} onChange={e=>{setP(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="••••••" style={S.input}/>
          </div>
          {err&&<div style={{marginBottom:"0.875rem",padding:"0.5rem 0.75rem",
            background:err.includes("✅")?"rgba(251,191,36,0.12)":"rgba(239,68,68,0.12)",
            border:err.includes("✅")?"1px solid rgba(251,191,36,0.3)":"1px solid rgba(239,68,68,0.2)",
            borderRadius:"0.6rem",
            color:err.includes("✅")?C.gold:"#fca5a5",
            fontSize:"0.7rem",fontWeight:600}}>{err}</div>}
          <button onClick={submit} disabled={loading} style={{...S.btn,width:"100%",padding:"0.875rem",background:`linear-gradient(90deg,${C.gold},${C.goldL})`,color:"#000",fontSize:"0.875rem",textTransform:"uppercase",letterSpacing:"0.1em",opacity:loading?0.6:1}}>
            {loading?"Verificando...":"Entrar al Prode →"}
          </button>
        </div>
      </div>
    </div>
  );
}


// --- FLOATING INFO BUTTON -----------------------------------------------------
function FloatingInfo({onOpen}) {
  const [pos,setPos] = useState({x:null,y:null});
  const [dragging,setDragging] = useState(false);
  const dragRef = useRef(null);
  const startRef = useRef(null);

  const handleStart = (clientX,clientY) => {
    startRef.current = {clientX,clientY,startX:pos.x??20,startY:pos.y??200};
    setDragging(false);
    dragRef.current = {clientX,clientY};
  };
  const handleMove = (clientX,clientY) => {
    if(!startRef.current) return;
    const dx = clientX - startRef.current.clientX;
    const dy = clientY - startRef.current.clientY;
    if(Math.abs(dx)>5||Math.abs(dy)>5) setDragging(true);
    const newX = Math.max(0, Math.min(window.innerWidth-52, startRef.current.startX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight-120, startRef.current.startY + dy));
    setPos({x:newX,y:newY});
  };
  const handleEnd = () => {
    if(!dragging) onOpen();
    startRef.current = null;
  };

  const x = pos.x ?? 20;
  const y = pos.y ?? (window.innerHeight ? window.innerHeight*0.35 : 250);

  return (
    <div
      onMouseDown={e=>{e.preventDefault();handleStart(e.clientX,e.clientY);
        const mm=ev=>handleMove(ev.clientX,ev.clientY);
        const mu=()=>{handleEnd();window.removeEventListener('mousemove',mm);window.removeEventListener('mouseup',mu);};
        window.addEventListener('mousemove',mm);window.addEventListener('mouseup',mu);}}
      onTouchStart={e=>{const t=e.touches[0];handleStart(t.clientX,t.clientY);
        const tm=ev=>{ev.preventDefault();const tt=ev.touches[0];handleMove(tt.clientX,tt.clientY);};
        const te=()=>{handleEnd();window.removeEventListener('touchmove',tm);window.removeEventListener('touchend',te);};
        window.addEventListener('touchmove',tm,{passive:false});window.addEventListener('touchend',te);}}
      style={{position:"fixed",left:x,top:y,zIndex:99,cursor:dragging?"grabbing":"grab",userSelect:"none",touchAction:"none"}}>
      <div style={{width:"44px",height:"44px",borderRadius:"50%",background:"rgba(10,26,10,0.92)",border:"1px solid rgba(255,255,255,0.18)",backdropFilter:"blur(12px)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,0.4)"}}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      </div>
    </div>
  );
}

// --- DESIGNADOS VIEW ----------------------------------------------------------
function DesignadosView({currentUser, mode='designados'}) {
  const [data,setData] = useState([]);
  const [loading,setLoading] = useState(true);
  const desigLocked = isDesignatedLocked();
  const allLocked = isSpecialsLocked();

  useEffect(()=>{
    const load = async () => {
      setLoading(true);
      try {
        const [users, spData] = await Promise.all([
          sGetApprovedUsers(),
          sbFetch("specials?select=username,data")
        ]);
        const spMap = {};
        (spData||[]).forEach(r=>{ spMap[r.username]=r.data||{}; });
        const rows = users.map(u=>({
          username: u.username,
          fullName: u.full_name||u.username,
          goleadorDesignado: spMap[u.username]?.goleadorDesignado||"",
          arqueroDesignado: spMap[u.username]?.arqueroDesignado||"",
          campeon: spMap[u.username]?.campeon||"",
          subcampeon: spMap[u.username]?.subcampeon||"",
          goleador: spMap[u.username]?.goleador||"",
        }));
        setData(rows);
      } catch(_){}
      setLoading(false);
    };
    load();
  },[]);

  const playerName = (id) => {
    if(!id) return "—";
    // PLAYERS is {teamId:[names...]}, value stored is the name string directly
    return id;
  };

  if(loading) return (
    <div style={{textAlign:"center",padding:"3rem 0",color:"rgba(255,255,255,0.3)",fontSize:"0.8rem"}}>Cargando...</div>
  );

  const userRow = (u, children) => (
    <div key={u.username} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0.75rem",background:u.username===currentUser?"rgba(251,191,36,0.06)":"rgba(255,255,255,0.03)",border:`1px solid ${u.username===currentUser?"rgba(251,191,36,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:"0.6rem",marginBottom:"0.4rem"}}>
      <div style={{width:"1.6rem",height:"1.6rem",borderRadius:"0.35rem",background:"rgba(251,191,36,0.15)",display:"flex",alignItems:"center",justifyContent:"center",color:C.gold,fontWeight:900,fontSize:"0.7rem",flexShrink:0}}>{(u.fullName)[0].toUpperCase()}</div>
      <div style={{fontSize:"0.7rem",fontWeight:700,color:"rgba(255,255,255,0.7)",minWidth:"80px",flexShrink:0}}>{u.fullName}</div>
      <div style={{flex:1,display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>{children}</div>
    </div>
  );

  if(mode==="designados") return (
    <div style={{padding:"0 1rem"}}>
      <div style={{fontSize:"0.6rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.1em",color:"rgba(255,255,255,0.35)",marginBottom:"0.75rem"}}>👟 Goleador Designado · 🧤 Arquero Designado</div>
      {data.map(u=>userRow(u,<>
        <span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.45)"}}>👟 <span style={{color:"white",fontWeight:700}}>{u.goleadorDesignado||"—"}</span></span>
        <span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.45)"}}>🧤 <span style={{color:"white",fontWeight:700}}>{u.arqueroDesignado||"—"}</span></span>
      </>))}
    </div>
  );

  if(mode==="todos") return (
    <div style={{padding:"0 1rem"}}>
      <div style={{fontSize:"0.6rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.1em",color:"rgba(255,255,255,0.35)",marginBottom:"0.75rem"}}>🏆 Campeón · 🥈 Subcampeón · 👟 Goleador</div>
      {data.map(u=>userRow(u,<>
        {u.campeon&&T[u.campeon]&&<span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.45)"}}>🏆 <span style={{color:"white",fontWeight:700}}>{T[u.campeon].short}</span></span>}
        {u.subcampeon&&T[u.subcampeon]&&<span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.45)"}}>🥈 <span style={{color:"white",fontWeight:700}}>{T[u.subcampeon].short}</span></span>}
        {u.goleador&&<span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.45)"}}>👟 <span style={{color:"white",fontWeight:700}}>{u.goleador}</span></span>}
      </>))}
    </div>
  );

  return null;
}

// --- APP ----------------------------------------------------------------------
export default function App() {
  const [ready,setReady]   = useState(false);
  const [user,setUser]       = useState(null);
  const [fullName,setFullName] = useState("");
  const [view,setView]     = useState("grupos"); // "grupos" | "finales"
  const [rulesOpen,setRulesOpen]   = useState(false);
  const [navTab,setNavTab]         = useState("pronosticos"); // bottom nav active tab
  const [infoOpen,setInfoOpen]     = useState(false);
  const [muroOpen,setMuroOpen]     = useState(false);
  const [muroIdx,setMuroIdx]       = useState(0);
  const [rankModalOpen,setRankModal] = useState(false);
  const [subRound,setSubRound] = useState(null); // null = nothing open
  const [fScores,setFScores]   = useState({}); // knockout scores keyed by matchId
  const [fJokers,setFJokers]   = useState([]); // max 2 per user for finales
  const [scores,setScores] = useState(emptyScores);
  const [sp,setSp]         = useState({campeon:"",subcampeon:"",goleador:"",goleadorDesignado:"",arqueroDesignado:"",clasificados:{grupos:{}}});
  const [jokers,setJokers] = useState([]);
  const [realRes,setReal]  = useState(null);
  const [spOpen,setSpOpen] = useState(false);
  const [openF,setOpenF]   = useState(null);
  const [openG,setOpenG]   = useState(null);
  const [openEspSection,setOpenEspSection] = useState('especiales'); // 'especiales'|'designados'|'todos'|null
  const [vis,setVis]       = useState(PAGE_SIZE);
  const [saveOk,setSaveOk] = useState(false);
  const [ranking,setRank]  = useState([]);
  const [rankOpen,setRankOpen] = useState(false);
  const [rankLoad,setRankLoad] = useState(false);

  useEffect(()=>{
    let alive=true;
    const load=async()=>{
      try {
        // Load session from localStorage
        const savedUser = localStorage.getItem("prode_user");
        const savedFullName = localStorage.getItem("prode_fullname");
        if(savedFullName) setFullName(savedFullName);
        const rr = await sGetRealResults().catch(()=>null);
        if(!alive) return;
        if(rr) setReal(rr);
        if(savedUser){
          const username = savedUser;
          const [sc,sp,jk,fsc,fjk] = await Promise.all([
            sGetScores(username), sGetSpecials(username), sGetJokers(username),
            sGetFScores(username), sGetFJokers(username)
          ]);
          if(!alive) return;
          setUser(username);
          if(sc) setScores(sc);
          if(sp) setSp(sp);
          if(jk) setJokers(jk);
          if(fsc) setFScores(fsc);
          if(fjk) setFJokers(fjk.map?fjk.map(String):fjk);
        }
      } catch(_){}
      if(alive) setReady(true);
    };
    load();
    const t=setTimeout(()=>{if(alive)setReady(true);},2000);
    return()=>{alive=false;clearTimeout(t);};
  },[]);

  // Poll for reset flag every 15 seconds
  useEffect(()=>{
    if(!user||user==="admin") return;
    const savedResetAt = localStorage.getItem("prode_reset_at");
    const check = async () => {
      try {
        const rr = await sGetRealResults();
        if(rr?.resetAt && rr.resetAt !== savedResetAt) {
          localStorage.removeItem("prode_user");
          localStorage.removeItem("prode_fullname");
          localStorage.setItem("prode_reset_at", rr.resetAt);
          window.location.reload();
        }
      } catch(_){}
    };
    check();
    const t = setInterval(check, 15000);
    return()=>clearInterval(t);
  },[user]);

  // Auto-save scores - save individual score on change
  const handleScore=useCallback((id,side,v)=>{
    if(isLocked(id)) return; // bloqueo en servidor, no solo en UI
    setScores(p=>{
      const ns={...p,[id]:{...p[id],[side]:v}};
      if(user) sSetScore(user,id,side==="home"?v:ns[id]?.home||"",side==="away"?v:ns[id]?.away||"");
      return ns;
    });
    setSaveOk(true);setTimeout(()=>setSaveOk(false),1500);
  },[user]);
  // Save specials debounced
  useEffect(()=>{if(!user)return;const t=setTimeout(()=>sSetSpecials(user,sp),800);return()=>clearTimeout(t);},[sp,user]);
  // Save jokers
  useEffect(()=>{if(!user)return;const t=setTimeout(()=>sSetJokers(user,jokers),800);return()=>clearTimeout(t);},[jokers,user]);
  // Save fjokers
  useEffect(()=>{if(!user)return;const t=setTimeout(()=>sSetFJokers(user,fJokers),800);return()=>clearTimeout(t);},[fJokers,user]);
  // Save fScores - batch save all knockout scores
  useEffect(()=>{
    if(!user||!Object.keys(fScores).length) return;
    const t=setTimeout(async()=>{
      const rows=Object.entries(fScores).map(([id,s])=>({username:user,match_id:String(id),home:s.home||"",away:s.away||""}));
      if(rows.length) await sbFetch("fscores","POST",rows);
    },800);
    return()=>clearTimeout(t);
  },[fScores,user]);







  const handleJoker=useCallback(id=>{
    setJokers(p=>{
      const nj=p.includes(id)?p.filter(x=>x!==id):p.length>=2?p:[...p,id];
      if(user) sSetJokers(user,nj);
      return nj;
    });
  },[user]);

  const handleLogin=useCallback(async(un,fn,sc,sp,jk,fsc,fjk)=>{
    setUser(un);
    setFullName(fn||un);
    if(sc) setScores(sc);
    if(sp) setSp(p=>({...p,...sp}));
    if(jk) setJokers(jk);
    if(fsc) setFScores(fsc);
    if(fjk) setFJokers(fjk.map?fjk.map(String):fjk);
    localStorage.setItem("prode_user", un);
    localStorage.setItem("prode_fullname", fn||un);
  },[]);

  const handleLogout=useCallback(()=>{
    localStorage.removeItem("prode_user");
    localStorage.removeItem("prode_fullname");
    setUser(null);
    setFullName("");
    setScores(emptyScores());
    setSp({campeon:"",subcampeon:"",goleador:"",goleadorDesignado:"",arqueroDesignado:"",clasificados:{grupos:{}}});
    setJokers([]);setFScores({});setFJokers([]);
    setOpenF(null);setOpenG(null);setVis(PAGE_SIZE);setSubRound(null);
  },[]);

  const loadRanking=useCallback(async()=>{
    setRankLoad(true);
    try {
      const rr = await sGetRealResults();
      if(rr) setReal(rr);
      const [allSc,spData,allJk]=await Promise.all([sGetAllScores(),sbFetch("specials?select=username,data"),sGetAllJokers()]);
      const spMap={};(spData||[]).forEach(r=>{spMap[r.username]=r.data||{};});
      const users=Object.keys(allSc).filter(u=>u!=="admin");
      const rows=await Promise.all(users.map(async un=>{
        const sc=allSc[un]||{},usp=spMap[un]||{},jk=allJk[un]||[];
        const filled=ALL_MATCHES.filter(m=>{const s=sc[m.id];return s&&!isNaN(parseInt(s.home))&&!isNaN(parseInt(s.away));}).length;
        let pts=null;
        if(rr){const rObj=Object.fromEntries(ALL_MATCHES.map(m=>[m.id,rr.scores?.[m.id]]));pts=calcPoints(sc,usp,{...rObj,...rr.specials},jk);}
        return {username:un,filled,total:ALL_MATCHES.length,pts};
      }));
      rows.sort((a,b)=>(b.pts?.total??-(b.filled*0.001))-(a.pts?.total??-(a.filled*0.001))||a.username.localeCompare(b.username));
      setRank(rows);
    } catch(_){}
    setRankLoad(false);
  },[]);

  const totalPlayed=ALL_MATCHES.filter(m=>{const s=scores[m.id];return s&&!isNaN(parseInt(s.home))&&!isNaN(parseInt(s.away));}).length;
  let myPts=null;
  try{if(realRes){const rObj=Object.fromEntries(ALL_MATCHES.map(m=>[m.id,realRes.scores?.[m.id]]));myPts=calcPoints(scores,sp,{...rObj,...realRes.specials},jokers);}}catch(_){}
  const jLeft=2-jokers.length;
  const vF=FECHAS.slice(0,vis),hasMore=vis<FECHAS.length,rem=FECHAS.length-vis;

  if(!ready) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT,WebkitFontSmoothing:"antialiased"}}>
      <GrassBg/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",color:"white"}}>
        <div style={{fontSize:"3rem",marginBottom:"1rem"}}>⚽</div>
        <div style={{color:C.muted,fontWeight:900,letterSpacing:"0.2em",textTransform:"uppercase",fontSize:"0.875rem"}}>Cargando...</div>
      </div>
    </div>
  );

  if(!user) return <Login onLogin={handleLogin}/>;
  if(user==="admin") return <AdminPanel onLogout={handleLogout}/>;

  // Active nav tab drives which "page" shows
  const showMuro = navTab==="muro";
  const showRanking = navTab==="ranking";
  const showInfo = navTab==="info";
  const showEspeciales = navTab==="especiales";
  const showPosiciones = navTab==="posiciones";
  const showPronosticos = navTab==="pronosticos";

  return (
    <div style={{height:"100vh",fontFamily:FONT,position:"relative",color:"white",WebkitFontSmoothing:"antialiased",MozOsxFontSmoothing:"grayscale",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <GrassBg/>
      <div style={{position:"relative",zIndex:1,maxWidth:"672px",margin:"0 auto",width:"100%",display:"flex",flexDirection:"column",height:"100%"}}>

        {/* STICKY HEADER — siempre visible, botones de fase solo en pronósticos */}
        <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(10,26,10,0.97)",backdropFilter:"blur(12px)",padding:`1.5rem 1rem ${showPronosticos?"0.9rem":"1rem"}`,borderBottom:"1px solid rgba(255,255,255,0.07)"}}>

          {/* User bar */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:showPronosticos?"1.15rem":"0",gap:"0.5rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
              <div style={{width:"2rem",height:"2rem",borderRadius:"0.5rem",background:"rgba(251,191,36,0.2)",border:"1px solid rgba(251,191,36,0.3)",display:"flex",alignItems:"center",justifyContent:"center",color:C.gold,fontWeight:900,fontSize:"0.85rem",flexShrink:0}}>{(fullName||user)[0].toUpperCase()}</div>
              <div style={{lineHeight:1.2}}>
                <div style={{fontWeight:900,fontSize:"0.85rem",color:"rgba(255,255,255,0.9)"}}>{fullName||user}</div>
                <div style={{fontSize:"0.58rem",color:C.muted}}>@{user}</div>
              </div>
              {myPts&&<div style={{padding:"0.15rem 0.5rem",background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:"99px",fontSize:"0.72rem",fontWeight:900,color:C.gold}}>{myPts.total} pts <span style={{fontSize:"0.58rem",color:C.muted,fontWeight:400}}>({myPts.partidos}+{myPts.especiales})</span></div>}
              {saveOk&&<span style={{fontSize:"0.65rem",fontWeight:700,color:C.emerald}}>✓</span>}
            </div>
            <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
              <button onClick={async()=>{const ok=await registerPush();if(ok)alert("✅ Notificaciones activadas.");else alert("No se pudieron activar. Verificá los permisos.");}}
                style={{...S.btn,width:"2rem",height:"2rem",borderRadius:"50%",fontSize:"0.9rem",background:"rgba(56,189,248,0.1)",border:"1px solid rgba(56,189,248,0.2)",color:C.sky}}>🔔</button>
              <button onClick={handleLogout} style={{...S.btn,padding:"0.3rem 0.6rem",background:C.surface,border:`1px solid ${C.border}`,color:C.muted,fontSize:"0.65rem",textTransform:"uppercase"}}>Salir</button>
            </div>
          </div>

          {/* View tabs — solo en pronósticos */}
          {showPronosticos && (
            <div style={{display:"flex",gap:"0.5rem"}}>
              <button onClick={()=>{setView("grupos");setNavTab("pronosticos");}} style={{...S.btn,flex:1,padding:"0.6rem",fontSize:"0.8rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.08em",border:"2px solid",borderColor:view==="grupos"?C.gold:"rgba(255,255,255,0.12)",color:view==="grupos"?"#000":C.muted,background:view==="grupos"?`linear-gradient(135deg,${C.gold},${C.goldL})`:"rgba(255,255,255,0.04)",transition:"all 0.2s"}}>⚽ Fase Grupos</button>
              <button onClick={()=>{setView("finales");setNavTab("pronosticos");}} style={{...S.btn,flex:1,padding:"0.6rem",fontSize:"0.8rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.08em",border:"2px solid",borderColor:view==="finales"?C.violet:"rgba(255,255,255,0.12)",color:view==="finales"?"#000":C.muted,background:view==="finales"?`linear-gradient(135deg,${C.violet},#c4b5fd)`:"rgba(255,255,255,0.04)",transition:"all 0.2s"}}>🏆 Fases Finales</button>
            </div>
          )}

          {/* Sub-header pronósticos grupos: título + progreso + comodines */}
          {showPronosticos && view==="grupos" && (
            <div style={{marginTop:"0.75rem",paddingTop:"0.65rem",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"0.4rem"}}>
                <h2 style={{margin:0,fontSize:"0.85rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.05em",color:"rgba(255,255,255,0.8)"}}>Pronósticos</h2>
                <div style={{flex:1,height:"1px",background:`linear-gradient(90deg,rgba(251,191,36,0.3),transparent)`}}/>
                <span style={{fontSize:"0.55rem",color:C.muted}}>FASE DE GRUPOS</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.4rem"}}>
                <div style={{flex:1,height:"3px",background:"rgba(255,255,255,0.08)",borderRadius:"99px",overflow:"hidden"}}>
                  <div style={{height:"100%",background:`linear-gradient(90deg,${C.gold},${C.goldL})`,width:`${ALL_MATCHES.length?(totalPlayed/ALL_MATCHES.length)*100:0}%`,transition:"width 0.5s"}}/>
                </div>
                <span style={{fontSize:"0.55rem",color:C.muted,flexShrink:0}}>{totalPlayed}/{ALL_MATCHES.length}</span>
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:"0.35rem",padding:"0.2rem 0.5rem",background:jLeft>0?"rgba(251,191,36,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${jLeft>0?"rgba(251,191,36,0.25)":C.border}`,borderRadius:"99px"}}>
                <span style={{fontSize:"0.75rem"}}>🃏</span>
                <span style={{fontWeight:900,fontSize:"0.62rem",color:jLeft>0?C.gold:C.muted}}>{jLeft} comodín{jLeft!==1?"es":""} restante{jLeft!==1?"s":""}</span>
                <span style={{fontSize:"0.55rem",color:"rgba(255,255,255,0.2)"}}>· x2 pts</span>
              </div>
            </div>
          )}

          {/* Especiales accordion bars — sticky, solo en especiales */}
          {showEspeciales && (
            <div style={{marginTop:"0.6rem",borderTop:"1px solid rgba(255,255,255,0.06)"}}>

              <button onClick={()=>setOpenEspSection(p=>p==="especiales"?null:"especiales")}
                style={{...S.btn,width:"100%",display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.55rem 0",background:"none",border:"none",borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
                <span style={{fontSize:"0.9rem"}}>⭐</span>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{fontSize:"0.72rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em",color:C.gold}}>Pronósticos Especiales</div>
                  <div style={{fontSize:"0.52rem",color:C.muted}}>Campeón · Goleador · Arquero · Clasificados</div>
                </div>
                {isSpecialsLocked()
                  ? <span style={{fontSize:"0.6rem",fontWeight:900,background:"rgba(251,113,133,0.15)",color:"#fb7185",padding:"0.15rem 0.4rem",borderRadius:"0.3rem"}}>🔒</span>
                  : <span style={{fontSize:"0.6rem",color:C.muted}}>{[sp.campeon,sp.subcampeon,sp.goleador,sp.goleadorDesignado,sp.arqueroDesignado].filter(Boolean).length}/5</span>
                }
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={openEspSection==="especiales"?"M18 15l-6-6-6 6":"M6 9l6 6 6-6"}/>
                </svg>
              </button>

              <button onClick={()=>{ if(isDesignatedLocked()) setOpenEspSection(p=>p==="designados"?null:"designados"); }}
                style={{...S.btn,width:"100%",display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.55rem 0",background:"none",border:"none",borderBottom:`1px solid rgba(255,255,255,0.05)`,opacity:isDesignatedLocked()?1:0.45,cursor:isDesignatedLocked()?"pointer":"default"}}>
                <span style={{fontSize:"0.9rem"}}>🎯</span>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{fontSize:"0.72rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em",color:isDesignatedLocked()?C.emerald:"rgba(255,255,255,0.35)"}}>Designados</div>
                  <div style={{fontSize:"0.52rem",color:C.muted}}>{isDesignatedLocked()?"Goleador · Arquero de todos":"🔒 Disponible 14 mayo · 07:50 BOT"}</div>
                </div>
                {isDesignatedLocked()
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={openEspSection==="designados"?"M18 15l-6-6-6 6":"M6 9l6 6 6-6"}/></svg>
                  : <span style={{fontSize:"0.7rem"}}>🔒</span>
                }
              </button>

              <button onClick={()=>{ if(isSpecialsLocked()) setOpenEspSection(p=>p==="todos"?null:"todos"); }}
                style={{...S.btn,width:"100%",display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.55rem 0",background:"none",border:"none",opacity:isSpecialsLocked()?1:0.45,cursor:isSpecialsLocked()?"pointer":"default"}}>
                <span style={{fontSize:"0.9rem"}}>🏆</span>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{fontSize:"0.72rem",fontWeight:900,textTransform:"uppercase",letterSpacing:"0.06em",color:isSpecialsLocked()?C.violet:"rgba(255,255,255,0.35)"}}>Especiales de todos</div>
                  <div style={{fontSize:"0.52rem",color:C.muted}}>{isSpecialsLocked()?"Campeón · Subcampeón · Goleador de todos":"🔒 Disponible 15 mayo · 17:50 BOT"}</div>
                </div>
                {isSpecialsLocked()
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={openEspSection==="todos"?"M18 15l-6-6-6 6":"M6 9l6 6 6-6"}/></svg>
                  : <span style={{fontSize:"0.7rem"}}>🔒</span>
                }
              </button>

            </div>
          )}

        </div>{/* END STICKY HEADER */}

        {/* SCROLLABLE CONTENT */}
        <div style={{flex:1,overflowY:"auto",padding:"0 1rem 80px",WebkitOverflowScrolling:"touch"}}>

        {/* Modals */}
        {rulesOpen && <RulesModal onClose={()=>setRulesOpen(false)}/>}
        {muroOpen && <MuroModal onClose={()=>{setMuroOpen(false);setNavTab("pronosticos");}} muroIdx={muroIdx} setMuroIdx={setMuroIdx} currentUser={user}/>}
        {rankModalOpen && <RankingModal onClose={()=>{setRankModal(false);setNavTab("pronosticos");}} currentUser={user} realRes={realRes}/>}

        {/* FASE GRUPOS - Pronósticos */}
        {view==="grupos" && showPronosticos && (
          <div style={{paddingTop:"0.5rem",paddingBottom:"0.5rem"}}>
            {FECHAS.map((f,i)=>(
              <FechaSection key={f.id} fecha={f} index={i} isOpen={openF===f.id} onToggle={()=>setOpenF(p=>p===f.id?null:f.id)} scores={scores} onScore={handleScore} jokers={jokers} onJoker={handleJoker} jLeft={jLeft}/>
            ))}
          </div>
        )}

        {/* FASE GRUPOS - Especiales: content only, bars are in sticky header */}
        {view==="grupos" && showEspeciales && (
          <div style={{paddingTop:"0.5rem"}}>
            {openEspSection==="especiales" && (
              <SpecialPicks sp={sp} onChange={(k,v)=>setSp(p=>({...p,[k]:v}))} isOpen={true} onToggle={()=>{}} locked={isSpecialsLocked()} designatedLocked={isDesignatedLocked()}/>
            )}
            {openEspSection==="designados" && isDesignatedLocked() && (
              <DesignadosView currentUser={user} mode="designados"/>
            )}
            {openEspSection==="todos" && isSpecialsLocked() && (
              <DesignadosView currentUser={user} mode="todos"/>
            )}
          </div>
        )}

        {/* Posiciones */}
        {showPosiciones && (
          <div style={{paddingTop:"0.85rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"1rem"}}>
              <h2 style={{margin:0,fontSize:"1rem",fontWeight:900,textTransform:"uppercase",color:C.emerald}}>Tabla de Posiciones</h2>
              <div style={{flex:1,height:"1px",background:"linear-gradient(90deg,rgba(52,211,153,0.3),transparent)"}}/>
            </div>
            {Object.keys(GROUPS).map((gid,i)=>(
              <GroupTable key={gid} gid={gid} gi={i} scores={scores} isOpen={openG===gid} onToggle={()=>setOpenG(p=>p===gid?null:gid)}/>
            ))}
          </div>
        )}

        {/* Muro */}
        {showMuro && (
          <div style={{paddingTop:"0.85rem"}}>
          <MuroModal onClose={()=>setNavTab("pronosticos")} muroIdx={muroIdx} setMuroIdx={setMuroIdx} currentUser={user} inline={true}/>
          </div>
        )}

        {/* Ranking */}
        {showRanking && (
          <div style={{paddingTop:"0.85rem"}}>
          <RankingModal onClose={()=>setNavTab("pronosticos")} currentUser={user} realRes={realRes} inline={true}/>
          </div>
        )}

        {/* Info */}
        {showInfo && (
          <div style={{paddingTop:"0.85rem"}}>
          <RulesModal onClose={()=>setNavTab("pronosticos")} inline={true}/>
          </div>
        )}

        {/* FASES FINALES */}
        {view==="finales" && showPronosticos && (
          <FasesFinales fScores={fScores} setFScores={setFScores} fJokers={fJokers} setFJokers={setFJokers} scores={scores} realRes={realRes} subRound={subRound} setSubRound={setSubRound} openF={openF} setOpenF={setOpenF}/>
        )}

        </div>{/* END SCROLLABLE CONTENT */}

      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"rgba(10,26,10,0.97)",borderTop:`1px solid rgba(255,255,255,0.1)`,backdropFilter:"blur(12px)",display:"flex",alignItems:"stretch",justifyContent:"space-around",height:"64px"}}>
        {[
          {id:"pronosticos", label:"Pronósticos", icon:"M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"},
          {id:"especiales", label:"Especiales", icon:"M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"},
          {id:"posiciones", label:"Posiciones", icon:"M3 10h18M3 14h18M3 6h18M3 18h18"},
          {id:"muro", label:"Muro", icon:"M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"},
          {id:"ranking", label:"Ranking", icon:"M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"},
          {id:"info", label:"Info", icon:"M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"},
        ].map(tab=>{
          const active = navTab===tab.id;
          const handleClick = () => {
            if(tab.id==="muro") { setNavTab("muro"); setMuroOpen(false); setRankModal(false); }
            else if(tab.id==="ranking") { setNavTab("ranking"); setMuroOpen(false); setRankModal(false); }
            else if(tab.id==="info") { setNavTab("info"); setMuroOpen(false); setRankModal(false); }
            else { setNavTab(tab.id); setMuroOpen(false); setRankModal(false); setRulesOpen(false); }
          };
          return (
            <button key={tab.id} onClick={handleClick}
              style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.2rem",background:"none",border:"none",cursor:"pointer",padding:"0.25rem 0",position:"relative",fontFamily:FONT}}>
              {active&&<span style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:"24px",height:"2px",background:C.gold,borderRadius:"0 0 2px 2px"}}/>}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active?C.gold:"rgba(255,255,255,0.35)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon}/>
              </svg>
              <span style={{fontSize:"0.52rem",fontWeight:active?700:400,color:active?C.gold:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.05em"}}>{tab.label}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
