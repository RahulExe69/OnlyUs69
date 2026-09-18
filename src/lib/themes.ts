export const THEMES = {
  light: {
    name: 'Clean Slate', note: 'Crisp, bright, and quietly minimal.', bg: '#F7F9FC', text: '#172033', header: 'rgba(255, 255, 255, .84)', owner: '#4263EB', ownerText: '#FFFFFF', partner: '#E8EDF6', partnerText: '#263247', input: '#FFFFFF', surface: '#FFFFFF', accent: '#4263EB', border: 'rgba(66, 99, 235, .16)', decoration: 'linear-gradient(135deg, rgba(66,99,235,.08), transparent 38%)', font: '"Inter", "Helvetica Neue", Arial, sans-serif'
  },
  dark: {
    name: 'Moonlight', note: 'A cinematic night chat with glowing edges.', bg: '#11121B', text: '#F6F4FF', header: 'rgba(24, 25, 39, .86)', owner: '#B69CFF', ownerText: '#171322', partner: '#28293A', partnerText: '#F0EDFF', input: '#202130', surface: '#1B1C29', accent: '#B69CFF', border: 'rgba(182, 156, 255, .22)', decoration: 'radial-gradient(circle at 16% 8%, rgba(182,156,255,.2), transparent 28%), radial-gradient(circle at 88% 76%, rgba(84,193,255,.12), transparent 24%)', font: '"Inter", "Helvetica Neue", Arial, sans-serif'
  },
  romantic: {
    name: 'Only Us', note: 'Soft rose curves made for your shared space with 3D fluttering Sakura Blossom petals.', bg: '#FFF7F8', text: '#3A202B', header: 'rgba(255, 250, 251, .86)', owner: '#E45F84', ownerText: '#FFFFFF', partner: '#FFE0E7', partnerText: '#663746', input: '#FFFFFF', surface: '#FFFDFD', accent: '#E45F84', border: 'rgba(228, 95, 132, .18)', decoration: 'radial-gradient(circle at 8% 14%, rgba(255,191,205,.48), transparent 25%), radial-gradient(circle at 94% 76%, rgba(255,221,194,.54), transparent 28%)', font: '"Nunito", "Inter", sans-serif'
  },
  lavender: {
    name: 'Lavender Haze', note: 'Velvety violet layers with a handwritten feel.', bg: '#F7F3FF', text: '#332748', header: 'rgba(249, 246, 255, .88)', owner: '#8062C7', ownerText: '#FFFFFF', partner: '#E8DFFF', partnerText: '#51406D', input: '#FEFCFF', surface: '#FCFAFF', accent: '#8062C7', border: 'rgba(128, 98, 199, .18)', decoration: 'radial-gradient(ellipse at 14% 8%, rgba(194,167,255,.38), transparent 30%), radial-gradient(ellipse at 88% 84%, rgba(232,223,255,.9), transparent 32%)', font: '"Georgia", "Times New Roman", serif'
  },
  ocean: {
    name: 'Ocean Eyes', note: 'Cool blue glass and gentle tidal movement.', bg: '#EDF8F8', text: '#173D43', header: 'rgba(242, 252, 252, .82)', owner: '#247C86', ownerText: '#FFFFFF', partner: '#D4EEEC', partnerText: '#26565C', input: '#FCFFFF', surface: '#F8FFFF', accent: '#247C86', border: 'rgba(36, 124, 134, .18)', decoration: 'radial-gradient(ellipse at 90% 4%, rgba(115,211,221,.34), transparent 34%), repeating-radial-gradient(ellipse at 0 100%, transparent 0 18px, rgba(36,124,134,.06) 19px 21px, transparent 38px)', font: '"Trebuchet MS", "Inter", sans-serif'
  },
  sunset: {
    name: 'Soft Bloom', note: 'Warm peach layers with a golden hour glow.', bg: '#FFF5EC', text: '#56352C', header: 'rgba(255, 249, 242, .88)', owner: '#CD6C58', ownerText: '#FFFFFF', partner: '#F8DDC8', partnerText: '#70473A', input: '#FFFCF8', surface: '#FFFAF5', accent: '#CD6C58', border: 'rgba(205, 108, 88, .18)', decoration: 'radial-gradient(circle at 12% 8%, rgba(255,201,142,.42), transparent 28%), radial-gradient(circle at 89% 84%, rgba(232,130,112,.2), transparent 30%)', font: '"Palatino Linotype", "Book Antiqua", serif'
  },
  doodle: {
    name: 'Doodle Day', note: 'Playful hand-drawn lines, stickers, and cheerful color.', bg: '#FFFBE7', text: '#263238', header: 'rgba(255, 253, 236, .92)', owner: '#FF6B6B', ownerText: '#FFFFFF', partner: '#FFFFFF', partnerText: '#263238', input: '#FFFFFF', surface: '#FFFDF3', accent: '#2878B5', border: 'rgba(38, 50, 56, .28)', decoration: 'radial-gradient(circle at 12% 16%, #FFD93D 0 2px, transparent 3px), radial-gradient(circle at 86% 12%, #6BCB77 0 3px, transparent 4px), radial-gradient(circle at 80% 82%, #4D96FF 0 2px, transparent 3px), repeating-linear-gradient(38deg, transparent 0 26px, rgba(38,50,56,.09) 27px 28px, transparent 29px 54px)', font: '"Comic Sans MS", "Marker Felt", cursive'
  },
  noir: {
    name: 'Film Noir', note: 'Ink-black contrast with a classic editorial edge.', bg: '#161616', text: '#F4EBDD', header: 'rgba(20, 20, 20, .92)', owner: '#E0B85C', ownerText: '#1A1712', partner: '#2A2926', partnerText: '#F4EBDD', input: '#242321', surface: '#1D1C1A', accent: '#E0B85C', border: 'rgba(224, 184, 92, .34)', decoration: 'linear-gradient(115deg, transparent 0 42%, rgba(224,184,92,.1) 42.3% 43%, transparent 43.3%), radial-gradient(ellipse at 82% 8%, rgba(255,255,255,.08), transparent 30%)', font: 'Georgia, "Times New Roman", serif'
  },
  forest: {
    name: 'Enchanted Forest', note: 'Mossy layers and firefly light after rain.', bg: '#102A24', text: '#EBF7DD', header: 'rgba(15, 44, 37, .88)', owner: '#C9E265', ownerText: '#19352A', partner: '#1E4537', partnerText: '#E5F6DB', input: '#183C31', surface: '#16352C', accent: '#C9E265', border: 'rgba(201, 226, 101, .25)', decoration: 'radial-gradient(circle at 12% 18%, rgba(201,226,101,.38) 0 2px, transparent 3px), radial-gradient(circle at 76% 23%, rgba(201,226,101,.34) 0 1px, transparent 3px), radial-gradient(circle at 90% 76%, rgba(89,166,114,.3), transparent 30%), repeating-linear-gradient(130deg, transparent 0 42px, rgba(201,226,101,.05) 43px 45px, transparent 46px 88px)', font: '"Trebuchet MS", "Segoe UI", sans-serif'
  },
  cyber: {
    name: 'Neon Arcade', note: 'Electric gridlines and unapologetic arcade energy.', bg: '#0B0920', text: '#F4F0FF', header: 'rgba(14, 10, 38, .9)', owner: '#FF3CAC', ownerText: '#FFFFFF', partner: '#1B1740', partnerText: '#73F7FF', input: '#151135', surface: '#100D2A', accent: '#73F7FF', border: 'rgba(115, 247, 255, .4)', decoration: 'linear-gradient(rgba(115,247,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(115,247,255,.12) 1px, transparent 1px), radial-gradient(circle at 50% 105%, rgba(255,60,172,.42), transparent 45%)', font: '"Courier New", monospace'
  },
  aurora: {
    name: 'Aurora Drift', note: 'A luminous northern-sky wash with soft glass.', bg: '#EAF8F7', text: '#16363F', header: 'rgba(238, 253, 252, .78)', owner: '#237A96', ownerText: '#FFFFFF', partner: '#D8EFEB', partnerText: '#1D4A54', input: '#F9FFFF', surface: '#F4FCFB', accent: '#8B5CF6', border: 'rgba(36, 143, 150, .2)', decoration: 'radial-gradient(ellipse at 8% 8%, rgba(139,92,246,.38), transparent 32%), radial-gradient(ellipse at 92% 18%, rgba(38,198,160,.38), transparent 36%), radial-gradient(ellipse at 48% 105%, rgba(46,168,210,.25), transparent 45%)', font: '"Avenir Next", "Trebuchet MS", sans-serif'
  },
  anime: {
    name: 'Anime Dream', note: 'Authentic hand-drawn manga artboard with halftone screentones, cel-shading, and anime stickers.', bg: '#FFFDF2', text: '#181829', header: 'rgba(255, 253, 242, .94)', owner: '#FF4757', ownerText: '#FFFFFF', partner: '#FFFFFF', partnerText: '#181829', input: '#FFFFFF', surface: '#FFF9EB', accent: '#00D2D3', border: 'rgba(24, 24, 41, .35)', decoration: 'radial-gradient(circle at 10% 12%, rgba(0,210,211,.25), transparent 28%), radial-gradient(circle at 90% 88%, rgba(255,71,87,.2), transparent 32%), radial-gradient(#181829 1.2px, transparent 1.2px)', font: '"Comic Sans MS", "Bangers", "Impact", cursive, sans-serif'
  },
  pokemon: {
    name: 'Pocket Monsters', note: 'Iconic trainer battle vibes with animated Pikachu, Gengar, and retro battle box styling.', bg: '#0F141C', text: '#FBFDFF', header: 'rgba(22, 28, 40, .9)', owner: '#EE3B3B', ownerText: '#FFFFFF', partner: '#222B3D', partnerText: '#F6F9FF', input: '#1B2232', surface: '#141A26', accent: '#FFCB05', border: 'rgba(255, 203, 5, .35)', decoration: 'radial-gradient(circle at 18% 12%, rgba(238,59,59,.25), transparent 32%), radial-gradient(circle at 82% 82%, rgba(255,203,5,.2), transparent 35%)', font: '"Trebuchet MS", "Inter", sans-serif'
  },
  akatsuki: {
    name: 'Akatsuki', note: 'The legendary rogue ninja syndicate. Blood-red clouds, Amegakure rainstorm, and dark chakra.', bg: '#08080D', text: '#F5F5FA', header: 'rgba(10, 10, 16, .92)', owner: '#B91C1C', ownerText: '#FFFFFF', partner: '#161722', partnerText: '#ECECF4', input: '#12131C', surface: '#0D0E17', accent: '#EF4444', border: 'rgba(239, 68, 68, .35)', decoration: 'radial-gradient(circle at 20% 15%, rgba(185,28,28,.28), transparent 35%), radial-gradient(circle at 80% 80%, rgba(239,68,68,.18), transparent 40%)', font: '"Cinzel", "Palatino Linotype", "Times New Roman", serif'
  },
  neural: {
    name: 'Neural Noise', note: 'Organic procedural neural noise with flowing synaptic currents and bio-glow.', bg: '#0A060A', text: '#FDF2F4', header: 'rgba(15, 9, 16, .88)', owner: '#E63366', ownerText: '#FFFFFF', partner: '#1A101C', partnerText: '#FCE7EB', input: '#150D18', surface: '#120B15', accent: '#E63366', border: 'rgba(230, 51, 102, .35)', decoration: 'radial-gradient(circle at 18% 15%, rgba(230,51,102,.28), transparent 38%), radial-gradient(circle at 82% 80%, rgba(255,102,153,.18), transparent 42%)', font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  // ==========================================
  // 3D VERSIONS OF ALL THEMES (IDENTICAL PALETTES & STYLES)
  // ==========================================
  '3d-romantic': {
    name: 'Only Us', note: 'Soft rose curves made for your shared space with 3D tumbling Sakura Blossom shader.', bg: '#FFF7F8', text: '#3A202B', header: 'rgba(255, 250, 251, .86)', owner: '#E45F84', ownerText: '#FFFFFF', partner: '#FFE0E7', partnerText: '#663746', input: '#FFFFFF', surface: '#FFFDFD', accent: '#E45F84', border: 'rgba(228, 95, 132, .18)', decoration: 'radial-gradient(circle at 8% 14%, rgba(255,191,205,.48), transparent 25%), radial-gradient(circle at 94% 76%, rgba(255,221,194,.54), transparent 28%)', font: '"Nunito", "Inter", sans-serif'
  },
  '3d-light': {
    name: 'Clean Slate', note: 'Crisp, bright, and quietly minimal with 3D geometric wireframe nodes.', bg: '#F7F9FC', text: '#172033', header: 'rgba(255, 255, 255, .84)', owner: '#4263EB', ownerText: '#FFFFFF', partner: '#E8EDF6', partnerText: '#263247', input: '#FFFFFF', surface: '#FFFFFF', accent: '#4263EB', border: 'rgba(66, 99, 235, .16)', decoration: 'linear-gradient(135deg, rgba(66,99,235,.08), transparent 38%)', font: '"Inter", "Helvetica Neue", Arial, sans-serif'
  },
  '3d-dark': {
    name: 'Moonlight', note: 'A cinematic night chat with glowing edges and 3D warp starlight.', bg: '#11121B', text: '#F6F4FF', header: 'rgba(24, 25, 39, .86)', owner: '#B69CFF', ownerText: '#171322', partner: '#28293A', partnerText: '#F0EDFF', input: '#202130', surface: '#1B1C29', accent: '#B69CFF', border: 'rgba(182, 156, 255, .22)', decoration: 'radial-gradient(circle at 16% 8%, rgba(182,156,255,.2), transparent 28%), radial-gradient(circle at 88% 76%, rgba(84,193,255,.12), transparent 24%)', font: '"Inter", "Helvetica Neue", Arial, sans-serif'
  },
  '3d-lavender': {
    name: 'Lavender Haze', note: 'Velvety violet layers with 3D volumetric violet aura spheres.', bg: '#F7F3FF', text: '#332748', header: 'rgba(249, 246, 255, .88)', owner: '#8062C7', ownerText: '#FFFFFF', partner: '#E8DFFF', partnerText: '#51406D', input: '#FEFCFF', surface: '#FCFAFF', accent: '#8062C7', border: 'rgba(128, 98, 199, .18)', decoration: 'radial-gradient(ellipse at 14% 8%, rgba(194,167,255,.38), transparent 30%), radial-gradient(ellipse at 88% 84%, rgba(232,223,255,.9), transparent 32%)', font: '"Georgia", "Times New Roman", serif'
  },
  '3d-ocean': {
    name: 'Ocean Eyes', note: 'Cool blue glass and 3D undulating tidal caustics with rising pearls.', bg: '#EDF8F8', text: '#173D43', header: 'rgba(242, 252, 252, .82)', owner: '#247C86', ownerText: '#FFFFFF', partner: '#D4EEEC', partnerText: '#26565C', input: '#FCFFFF', surface: '#F8FFFF', accent: '#247C86', border: 'rgba(36, 124, 134, .18)', decoration: 'radial-gradient(ellipse at 90% 4%, rgba(115,211,221,.34), transparent 34%), repeating-radial-gradient(ellipse at 0 100%, transparent 0 18px, rgba(36,124,134,.06) 19px 21px, transparent 38px)', font: '"Trebuchet MS", "Inter", sans-serif'
  },
  '3d-sunset': {
    name: 'Soft Bloom', note: 'Warm peach layers with 3D rising golden embers & firefly radiance.', bg: '#FFF5EC', text: '#56352C', header: 'rgba(255, 249, 242, .88)', owner: '#CD6C58', ownerText: '#FFFFFF', partner: '#F8DDC8', partnerText: '#70473A', input: '#FFFCF8', surface: '#FFFAF5', accent: '#CD6C58', border: 'rgba(205, 108, 88, .18)', decoration: 'radial-gradient(circle at 12% 8%, rgba(255,201,142,.42), transparent 28%), radial-gradient(circle at 89% 84%, rgba(232,130,112,.2), transparent 30%)', font: '"Palatino Linotype", "Book Antiqua", serif'
  },
  '3d-doodle': {
    name: 'Doodle Day', note: 'Playful hand-drawn lines with cheerful 3D bouncing confetti & stars.', bg: '#FFFBE7', text: '#263238', header: 'rgba(255, 253, 236, .92)', owner: '#FF6B6B', ownerText: '#FFFFFF', partner: '#FFFFFF', partnerText: '#263238', input: '#FFFFFF', surface: '#FFFDF3', accent: '#2878B5', border: 'rgba(38, 50, 56, .28)', decoration: 'radial-gradient(circle at 12% 16%, #FFD93D 0 2px, transparent 3px), radial-gradient(circle at 86% 12%, #6BCB77 0 3px, transparent 4px), radial-gradient(circle at 80% 82%, #4D96FF 0 2px, transparent 3px), repeating-linear-gradient(38deg, transparent 0 26px, rgba(38,50,56,.09) 27px 28px, transparent 29px 54px)', font: '"Comic Sans MS", "Marker Felt", cursive'
  },
  '3d-noir': {
    name: 'Film Noir', note: 'Ink-black contrast with 3D rotating gold facets & ember motes.', bg: '#161616', text: '#F4EBDD', header: 'rgba(20, 20, 20, .92)', owner: '#E0B85C', ownerText: '#1A1712', partner: '#2A2926', partnerText: '#F4EBDD', input: '#242321', surface: '#1D1C1A', accent: '#E0B85C', border: 'rgba(224, 184, 92, .34)', decoration: 'linear-gradient(115deg, transparent 0 42%, rgba(224,184,92,.1) 42.3% 43%, transparent 43.3%), radial-gradient(ellipse at 82% 8%, rgba(255,255,255,.08), transparent 30%)', font: 'Georgia, "Times New Roman", serif'
  },
  '3d-forest': {
    name: 'Enchanted Forest', note: 'Mossy layers with 3D rotating emerald crystals & fireflies.', bg: '#102A24', text: '#EBF7DD', header: 'rgba(15, 44, 37, .88)', owner: '#C9E265', ownerText: '#19352A', partner: '#1E4537', partnerText: '#E5F6DB', input: '#183C31', surface: '#16352C', accent: '#C9E265', border: 'rgba(201, 226, 101, .25)', decoration: 'radial-gradient(circle at 12% 18%, rgba(201,226,101,.38) 0 2px, transparent 3px), radial-gradient(circle at 76% 23%, rgba(201,226,101,.34) 0 1px, transparent 3px), radial-gradient(circle at 90% 76%, rgba(89,166,114,.3), transparent 30%), repeating-linear-gradient(130deg, transparent 0 42px, rgba(201,226,101,.05) 43px 45px, transparent 46px 88px)', font: '"Trebuchet MS", "Segoe UI", sans-serif'
  },
  '3d-cyber': {
    name: 'Neon Arcade', note: 'Electric retro-arcade WebGL shader with 3D outrun perspective grid, synthwave sun, and neon sine ribbons.', bg: '#0B0920', text: '#F4F0FF', header: 'rgba(14, 10, 38, .9)', owner: '#FF3CAC', ownerText: '#FFFFFF', partner: '#1B1740', partnerText: '#73F7FF', input: '#151135', surface: '#100D2A', accent: '#73F7FF', border: 'rgba(115, 247, 255, .4)', decoration: 'linear-gradient(rgba(115,247,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(115,247,255,.12) 1px, transparent 1px), radial-gradient(circle at 50% 105%, rgba(255,60,172,.42), transparent 45%)', font: '"Courier New", monospace'
  },
  '3d-aurora': {
    name: 'Aurora Drift', note: 'A luminous northern-sky wash with 3D shifting aurora borealis ribbons.', bg: '#EAF8F7', text: '#16363F', header: 'rgba(238, 253, 252, .78)', owner: '#237A96', ownerText: '#FFFFFF', partner: '#D8EFEB', partnerText: '#1D4A54', input: '#F9FFFF', surface: '#F4FCFB', accent: '#8B5CF6', border: 'rgba(36, 143, 150, .2)', decoration: 'radial-gradient(ellipse at 8% 8%, rgba(139,92,246,.38), transparent 32%), radial-gradient(ellipse at 92% 18%, rgba(38,198,160,.38), transparent 36%), radial-gradient(ellipse at 48% 105%, rgba(46,168,210,.25), transparent 45%)', font: '"Avenir Next", "Trebuchet MS", sans-serif'
  },
  '3d-anime': {
    name: 'Anime Dream', note: 'Authentic hand-drawn manga artboard with 3D animated anime stickers, sweatdrops, anger veins & manga SFX.', bg: '#FFFDF2', text: '#181829', header: 'rgba(255, 253, 242, .94)', owner: '#FF4757', ownerText: '#FFFFFF', partner: '#FFFFFF', partnerText: '#181829', input: '#FFFFFF', surface: '#FFF9EB', accent: '#00D2D3', border: 'rgba(24, 24, 41, .35)', decoration: 'radial-gradient(circle at 10% 12%, rgba(0,210,211,.25), transparent 28%), radial-gradient(circle at 90% 88%, rgba(255,71,87,.2), transparent 32%), radial-gradient(#181829 1.2px, transparent 1.2px)', font: '"Comic Sans MS", "Bangers", "Impact", cursive, sans-serif'
  },
  '3d-pokemon': {
    name: 'Pocket Monsters', note: 'Iconic trainer battle vibes with animated Pikachu, mischievous Gengar, and 3D Pokeballs.', bg: '#0F141C', text: '#FBFDFF', header: 'rgba(22, 28, 40, .9)', owner: '#EE3B3B', ownerText: '#FFFFFF', partner: '#222B3D', partnerText: '#F6F9FF', input: '#1B2232', surface: '#141A26', accent: '#FFCB05', border: 'rgba(255, 203, 5, .35)', decoration: 'radial-gradient(circle at 18% 12%, rgba(238,59,59,.25), transparent 32%), radial-gradient(circle at 82% 82%, rgba(255,203,5,.2), transparent 35%)', font: '"Trebuchet MS", "Inter", sans-serif'
  },
  '3d-akatsuki': {
    name: 'Akatsuki', note: 'The legendary rogue ninja syndicate with 3D drifting crimson clouds, Amegakure rainstorm, and shadow crows.', bg: '#08080D', text: '#F5F5FA', header: 'rgba(10, 10, 16, .92)', owner: '#B91C1C', ownerText: '#FFFFFF', partner: '#161722', partnerText: '#ECECF4', input: '#12131C', surface: '#0D0E17', accent: '#EF4444', border: 'rgba(239, 68, 68, .35)', decoration: 'radial-gradient(circle at 20% 15%, rgba(185,28,28,.28), transparent 35%), radial-gradient(circle at 80% 80%, rgba(239,68,68,.18), transparent 40%)', font: '"Cinzel", "Palatino Linotype", "Times New Roman", serif'
  },
  '3d-neural': {
    name: 'Neural Noise', note: 'Living WebGL procedural neural noise shader with flowing synaptic currents, action potential pulses, and bio-glow.', bg: '#0A060A', text: '#FDF2F4', header: 'rgba(15, 9, 16, .88)', owner: '#E63366', ownerText: '#FFFFFF', partner: '#1A101C', partnerText: '#FCE7EB', input: '#150D18', surface: '#120B15', accent: '#E63366', border: 'rgba(230, 51, 102, .35)', decoration: 'radial-gradient(circle at 18% 15%, rgba(230,51,102,.28), transparent 38%), radial-gradient(circle at 82% 80%, rgba(255,102,153,.18), transparent 42%)', font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  // Backwards compatibility aliases for existing saved themes
  '3d-aura': {
    name: 'Lavender Haze', note: 'Fluid 3D volumetric glowing orbs & stardust field.', bg: '#080811', text: '#F5F3FF', header: 'rgba(12, 11, 24, .82)', owner: '#A855F7', ownerText: '#FFFFFF', partner: '#1E1B38', partnerText: '#E0E7FF', input: '#121124', surface: '#0F0E20', accent: '#C084FC', border: 'rgba(168, 85, 247, .3)', decoration: 'radial-gradient(circle at 50% 20%, rgba(168,85,247,.22), transparent 45%)', font: '"Inter", system-ui, sans-serif'
  },
  '3d-cosmos': {
    name: 'Moonlight', note: 'Interactive 3D starfield warp with drifting nebulas and shooting stars.', bg: '#030712', text: '#F0F9FF', header: 'rgba(8, 15, 30, .85)', owner: '#0284C7', ownerText: '#FFFFFF', partner: '#0F172A', partnerText: '#E0F2FE', input: '#0C1322', surface: '#0B1120', accent: '#38BDF8', border: 'rgba(56, 189, 248, .28)', decoration: 'radial-gradient(circle at 50% 10%, rgba(56,189,248,.18), transparent 45%)', font: '"Inter", system-ui, sans-serif'
  },
  '3d-crystal': {
    name: 'Enchanted Forest', note: 'Floating 3D gemstone polyhedra rotating with firefly lights.', bg: '#041311', text: '#F0FDFA', header: 'rgba(6, 26, 23, .85)', owner: '#0D9488', ownerText: '#FFFFFF', partner: '#0F2926', partnerText: '#CCFBF1', input: '#08201D', surface: '#09221F', accent: '#2DD4BF', border: 'rgba(45, 212, 191, .28)', decoration: 'radial-gradient(circle at 40% 15%, rgba(45,212,191,.2), transparent 45%)', font: '"Inter", system-ui, sans-serif'
  },
  '3d-waves': {
    name: 'Neon Arcade', note: 'Flowing 3D neon sine ribbons and cybernetic grid waves with reactive tilt.', bg: '#0C0512', text: '#FFF1F2', header: 'rgba(20, 9, 28, .85)', owner: '#E11D48', ownerText: '#FFFFFF', partner: '#200F29', partnerText: '#FFE4E6', input: '#180B24', surface: '#170A22', accent: '#FB7185', border: 'rgba(251, 113, 133, .3)', decoration: 'radial-gradient(circle at 50% 15%, rgba(244,63,94,.22), transparent 45%)', font: '"Inter", system-ui, sans-serif'
  },
  '3d-cherry': {
    name: 'Only Us', note: 'Romantic 3D tumbling sakura blossom petals drifting on a gentle breeze.', bg: '#FFF5F6', text: '#4C1D24', header: 'rgba(255, 245, 246, .88)', owner: '#F43F5E', ownerText: '#FFFFFF', partner: '#FFE4E6', partnerText: '#881337', input: '#FFFFFF', surface: '#FFF0F2', accent: '#FB7185', border: 'rgba(251, 113, 133, .25)', decoration: 'radial-gradient(circle at 20% 15%, rgba(254,205,211,.5), transparent 35%)', font: '"Nunito", system-ui, sans-serif'
  }
};

export interface BaseThemeItem {
  key: string;
  name: string;
}

export const BASE_THEMES: BaseThemeItem[] = [
  { key: 'romantic', name: 'Only Us' },
  { key: 'light', name: 'Clean Slate' },
  { key: 'dark', name: 'Moonlight' },
  { key: 'anime', name: 'Anime Dream' },
  { key: 'pokemon', name: 'Pocket Monsters' },
  { key: 'akatsuki', name: 'Akatsuki' },
  { key: 'lavender', name: 'Lavender Haze' },
  { key: 'ocean', name: 'Ocean Eyes' },
  { key: 'sunset', name: 'Soft Bloom' },
  { key: 'doodle', name: 'Doodle Day' },
  { key: 'noir', name: 'Film Noir' },
  { key: 'forest', name: 'Enchanted Forest' },
  { key: 'cyber', name: 'Neon Arcade' },
  { key: 'aurora', name: 'Aurora Drift' },
  { key: 'neural', name: 'Neural Noise' }
];

export const toBaseThemeKey = (themeName?: string | null): string => {
  if (!themeName) return 'romantic';
  if (themeName === '3d-cherry') return 'romantic';
  if (themeName === '3d-cosmos') return 'dark';
  if (themeName === '3d-crystal') return 'forest';
  if (themeName === '3d-waves') return 'cyber';
  if (themeName === '3d-aura') return 'lavender';
  if (themeName.startsWith('3d-')) return themeName.substring(3);
  return themeName;
};

export const getThemeVariantKey = (baseKey: string, is3D: boolean): ThemeName => {
  const normBase = toBaseThemeKey(baseKey);
  const targetKey = is3D ? `3d-${normBase}` : normBase;
  if (targetKey in THEMES) return targetKey as ThemeName;
  return normBase as ThemeName;
};

export type ThemeName = keyof typeof THEMES;

export const DEFAULT_THEME: ThemeName = '3d-romantic';

export const is3DTheme = (themeName?: string | null): boolean => {
  if (!themeName || typeof themeName !== 'string') return true;
  return themeName.startsWith('3d-') || themeName === 'romantic' || themeName === 'neural';
};

export const getThemeCategory = (themeName: ThemeName): '3d' | 'dark' | 'light' => {
  if (themeName.startsWith('3d-')) return '3d';
  if (['dark', 'noir', 'cyber', 'forest', 'pokemon', 'akatsuki', 'neural'].includes(themeName)) return 'dark';
  return 'light';
};

export const THEME_CATEGORIES = [
  { id: 'all', label: 'All Themes', icon: '🌟' },
  { id: '3d', label: '3D Lag-Free', icon: '✨' },
  { id: 'dark', label: 'Dark / Night', icon: '🌙' },
  { id: 'light', label: 'Aesthetic / Light', icon: '🌸' }
] as const;

export const isValidTheme = (themeName: any): themeName is ThemeName => {
  return typeof themeName === 'string' && themeName in THEMES;
};

export const getTheme = (themeName?: string | null) => {
  if (themeName && isValidTheme(themeName)) {
    return THEMES[themeName];
  }
  return THEMES[DEFAULT_THEME];
};

export interface ThemeDualTone {
  color1: string; // Left/Start stop ("Only")
  color2: string; // Right/End stop ("Us")
  glow: string;   // Drop shadow glow for text
  bg: string;     // Atmospheric background for intro
  glow1: string;  // Top ambient radial glow
  glow2: string;  // Bottom ambient radial glow
  isDark: boolean;
}

export const THEME_DUAL_TONES: Record<string, ThemeDualTone> = {
  romantic: {
    color1: '#C66CFF',
    color2: '#FF4F8B',
    glow: 'rgba(255, 79, 139, 0.45)',
    bg: '#FFF7F8',
    glow1: 'rgba(255, 191, 205, 0.45)',
    glow2: 'rgba(255, 221, 194, 0.48)',
    isDark: false,
  },
  light: {
    color1: '#38BDF8',
    color2: '#4263EB',
    glow: 'rgba(66, 99, 235, 0.4)',
    bg: '#F7F9FC',
    glow1: 'rgba(56, 189, 248, 0.25)',
    glow2: 'rgba(66, 99, 235, 0.2)',
    isDark: false,
  },
  dark: {
    color1: '#54C1FF',
    color2: '#B69CFF',
    glow: 'rgba(182, 156, 255, 0.45)',
    bg: '#0E0F18',
    glow1: 'rgba(84, 193, 255, 0.16)',
    glow2: 'rgba(182, 156, 255, 0.18)',
    isDark: true,
  },
  lavender: {
    color1: '#C2A7FF',
    color2: '#8062C7',
    glow: 'rgba(128, 98, 199, 0.4)',
    bg: '#F7F3FF',
    glow1: 'rgba(194, 167, 255, 0.35)',
    glow2: 'rgba(232, 223, 255, 0.5)',
    isDark: false,
  },
  ocean: {
    color1: '#00D2D3',
    color2: '#247C86',
    glow: 'rgba(0, 210, 211, 0.4)',
    bg: '#EDF8F8',
    glow1: 'rgba(0, 210, 211, 0.25)',
    glow2: 'rgba(36, 124, 134, 0.22)',
    isDark: false,
  },
  sunset: {
    color1: '#FFA07A',
    color2: '#CD6C58',
    glow: 'rgba(205, 108, 88, 0.4)',
    bg: '#FFF5EC',
    glow1: 'rgba(255, 160, 122, 0.32)',
    glow2: 'rgba(205, 108, 88, 0.25)',
    isDark: false,
  },
  doodle: {
    color1: '#FF6B6B',
    color2: '#2878B5',
    glow: 'rgba(255, 107, 107, 0.4)',
    bg: '#FFFBE7',
    glow1: 'rgba(255, 217, 61, 0.35)',
    glow2: 'rgba(77, 150, 255, 0.25)',
    isDark: false,
  },
  noir: {
    color1: '#FFE082',
    color2: '#E0B85C',
    glow: 'rgba(224, 184, 92, 0.45)',
    bg: '#141414',
    glow1: 'rgba(255, 224, 130, 0.15)',
    glow2: 'rgba(224, 184, 92, 0.12)',
    isDark: true,
  },
  forest: {
    color1: '#C9E265',
    color2: '#10B981',
    glow: 'rgba(201, 226, 101, 0.45)',
    bg: '#0B1F19',
    glow1: 'rgba(201, 226, 101, 0.18)',
    glow2: 'rgba(16, 185, 129, 0.16)',
    isDark: true,
  },
  cyber: {
    color1: '#73F7FF',
    color2: '#FF3CAC',
    glow: 'rgba(115, 247, 255, 0.5)',
    bg: '#080717',
    glow1: 'rgba(115, 247, 255, 0.22)',
    glow2: 'rgba(255, 60, 172, 0.22)',
    isDark: true,
  },
  aurora: {
    color1: '#26C6A0',
    color2: '#8B5CF6',
    glow: 'rgba(139, 92, 246, 0.4)',
    bg: '#EAF8F7',
    glow1: 'rgba(38, 198, 160, 0.3)',
    glow2: 'rgba(139, 92, 246, 0.25)',
    isDark: false,
  },
  anime: {
    color1: '#00D2D3',
    color2: '#FF4757',
    glow: 'rgba(255, 71, 87, 0.45)',
    bg: '#FFFDF2',
    glow1: 'rgba(0, 210, 211, 0.28)',
    glow2: 'rgba(255, 71, 87, 0.22)',
    isDark: false,
  },
  pokemon: {
    color1: '#FFCB05',
    color2: '#EE3B3B',
    glow: 'rgba(255, 203, 5, 0.5)',
    bg: '#0C1118',
    glow1: 'rgba(255, 203, 5, 0.2)',
    glow2: 'rgba(238, 59, 59, 0.22)',
    isDark: true,
  },
  akatsuki: {
    color1: '#FF4D4D',
    color2: '#B91C1C',
    glow: 'rgba(239, 68, 68, 0.55)',
    bg: '#08080D',
    glow1: 'rgba(239, 68, 68, 0.22)',
    glow2: 'rgba(185, 28, 28, 0.24)',
    isDark: true,
  },
  neural: {
    color1: '#A855F7',
    color2: '#E63366',
    glow: 'rgba(230, 51, 102, 0.5)',
    bg: '#0A060A',
    glow1: 'rgba(168, 85, 247, 0.22)',
    glow2: 'rgba(230, 51, 102, 0.24)',
    isDark: true,
  },
};

export const getThemeDualTone = (themeName?: string | null): ThemeDualTone => {
  const base = toBaseThemeKey(themeName);
  if (base in THEME_DUAL_TONES) {
    return THEME_DUAL_TONES[base];
  }
  return THEME_DUAL_TONES.romantic;
};

export const applyTheme = (themeName: ThemeName) => {
  const theme = THEMES[themeName] || THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  root.dataset.chatTheme = themeName;
  root.style.setProperty('--theme-bg', theme.bg);
  root.style.setProperty('--theme-text', theme.text);
  root.style.setProperty('--theme-header-bg', theme.header);
  root.style.setProperty('--theme-bubble-owner', theme.owner);
  root.style.setProperty('--theme-bubble-owner-text', theme.ownerText);
  root.style.setProperty('--theme-bubble-partner', theme.partner);
  root.style.setProperty('--theme-bubble-partner-text', theme.partnerText);
  root.style.setProperty('--theme-input-bg', theme.input);
  root.style.setProperty('--theme-surface', theme.surface);
  root.style.setProperty('--theme-accent', theme.accent);
  root.style.setProperty('--theme-border', theme.border);
  root.style.setProperty('--theme-decoration', theme.decoration);
  root.style.setProperty('--theme-font', theme.font);

  // Set dual-tone theme variables for responsive intro and accents
  const dualTone = getThemeDualTone(themeName);
  root.style.setProperty('--theme-dual-color-1', dualTone.color1);
  root.style.setProperty('--theme-dual-color-2', dualTone.color2);
  root.style.setProperty('--theme-dual-glow', dualTone.glow);
  root.style.setProperty('--ou-main', dualTone.color2);
  root.style.setProperty('--ou-main2', dualTone.color1);
  root.style.setProperty('--ou-drop-shadow', dualTone.glow);
  root.style.setProperty('--ou-bg', dualTone.bg);
  root.style.setProperty('--ou-bg-glow-1', dualTone.glow1);
  root.style.setProperty('--ou-bg-glow-2', dualTone.glow2);
  root.style.setProperty('--ou-is-dark', dualTone.isDark ? '1' : '0');

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.accent);
  try {
    localStorage.setItem('onlyus_chat_theme', themeName);
  } catch (e) {}
};

// Immediate pre-render sync on script import to prevent theme flash
if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem('onlyus_chat_theme') as ThemeName;
    if (cached && isValidTheme(cached)) {
      applyTheme(cached);
    }
  } catch (e) {}
}
