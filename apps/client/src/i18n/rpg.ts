import type { RpgAiDifficulty, RpgElement, RpgMove, RpgSkillTicket, RpgSkillTier, RpgStatusId, RpgTarget } from "@renaiss-game/shared";

export type RpgLanguage = "en" | "zh" | "ko";

export const RPG_LANGUAGE_STORAGE_KEY = "renaissArenaLanguage";

type ElementCopy = {
  label: string;
  shortLabel: string;
  role: string;
};

type PetCopy = {
  name: string;
  title: string;
};

type RpgCopy = {
  common: {
    close: string;
    back: string;
    loading: string;
    retry: string;
    empty: string;
    none: string;
    all: string;
    view: string;
    synced: string;
    cached: string;
    reload: string;
    noImage: string;
  };
  profile: {
    panelLabel: string;
    title: string;
    subtitle: string;
    playerName: string;
    wallet: string;
    demoData: string;
    settings: string;
    languageHint: string;
    language: string;
    entry: string;
    entryHint: string;
    cabinet: string;
    cabinetHint: string;
    gym: string;
    gymHint: string;
    arena: string;
    arenaHint: string;
    interfaceLabel: string;
    profileButton: string;
    profileBadge: string;
    navLabel: string;
    village: string;
    cards: string;
    cardBag: string;
    cardCabinet: string;
    house: string;
    exitVillage: string;
  };
  cabinet: {
    aria: string;
    title: string;
    subtitle: string;
    demoWalletTitle: string;
    demoWalletBody: string;
    walletCardsAria: string;
    showcase: string;
    syncing: string;
    readFailed: string;
    noMatchingCards: string;
    noMatchingCardsHint: string;
    drawAll: (count: number) => string;
    drawing: (done: number, total: number) => string;
    allDrawn: string;
    elementDraw: (element: string, count: number) => string;
    elementAllDrawn: (element: string) => string;
    chooseElementForDraw: string;
    tierTabsAria: string;
    cacheNotice: (reason?: string | null) => string;
    boundCards: string;
    boundCardsHintAll: string;
    boundCardsHintElement: (element: string) => string;
    noBoundCards: string;
    noBoundCardsHint: string;
    equipToSlot: (element: string) => string;
    card: string;
    waitingForSkillCard: string;
    cardsCount: (count: number) => string;
    updatedAt: (time: string) => string;
    notSynced: string;
  };
  draw: {
    unbound: string;
    bound: string;
    drawTitle: (element: string) => string;
    drawReady: (element: string) => string;
    drawVideo: string;
    drawNoVideo: (element: string) => string;
    drawSkill: string;
    opening: (element: string) => string;
    revealing: string;
    animationAria: (moveName: string) => string;
    damage: string;
    energy: string;
    speed: string;
    animation: string;
    idleTitle: string;
    pool: (element?: string) => string;
  };
  equip: {
    panelAria: string;
    title: (petName: string) => string;
    subtitle: (element: string) => string;
    petSelectorAria: string;
    emptySlot: string;
    slot: (slot: number) => string;
    defaultSlot: (slot: number) => string;
    inspectMove: (moveName: string) => string;
    remove: string;
    noCards: (element: string) => string;
    candidateCard: string;
    equipped: string;
    skillName: (moveName: string) => string;
    cardName: (cardName: string) => string;
    equipSkill: string;
    removeSkill: string;
    removeSkillShort: string;
    equippedShort: string;
    emptyDetail: string;
    skillLibrary: string;
    libraryDescription: (element: string) => string;
    currentLoadout: (petName: string) => string;
    defaultSource: string;
    cardSource: string;
    noSkillCards: (element: string) => string;
  };
  gym: {
    aria: string;
    title: string;
    subtitle: string;
    tutorial: string;
    help: string;
    workbenchAria: string;
    aiDifficultyAria: string;
    aiBattle: string;
    aiMatch: (label: string) => string;
    versusBattle: string;
    connecting: string;
    createRoom: string;
    roomCode: string;
    joinRoom: string;
    partyAria: string;
    partyTitle: string;
    formationAria: string;
    editingSlot: string;
    cardSlot: string;
    editCardSlotTitle: string;
    editCardSlotAria: (petName: string) => string;
    removeFromPartyTitle: string;
    removeFromPartyAria: (petName: string) => string;
    emptyPartySlot: string;
    standby: string;
    editSlots: string;
    fieldSlot: (index: number) => string;
    formationSlots: Array<{ label: string; shortLabel: string }>;
  };
  battle: {
    versusWaitingAria: string;
    versusGym: string;
    creatingRoom: string;
    reconnecting: string;
    connecting: string;
    waitingPlayer: string;
    arenaAria: string;
    aiGym: string;
    localGym: string;
    turn: (turn: number) => string;
    battleSettings: string;
    exitVersus: string;
    exitAi: string;
    ally: string;
    enemy: string;
    opponentTurn: string;
    enemyTurn: string;
    waitingActor: string;
    acting: (name: string) => string;
    waitingOpponentMove: string;
    aiChoosingMove: string;
    noTarget: string;
    chooseSkillThenTarget: string;
    selectedMove: (moveName: string, targetName: string) => string;
    availableEnergy: (available: number, round: number) => string;
    reselect: string;
    selected: string;
    target: (targetName: string) => string;
    commandStatus: string;
    submitMoves: string;
    execute: string;
    actionStatusResync: string;
    actionStatusSubmitted: string;
    actionStatusAllocated: (spent: number, round: number) => string;
    actionStatusChoose: string;
    actionStatusWaiting: string;
    actionDetailCommand: (selected: number, living: number) => string;
    actionDetailActing: (name: string) => string;
    actionDetailWaiting: string;
    energyTitle: string;
    energyHint: string;
    energyAria: (energy: number) => string;
    energyPhase: (side: string, actor: string, energy: number, turnEnergy: number) => string;
    energyWaiting: (side: string) => string;
    resultAria: string;
    resultVersus: string;
    resultAi: string;
    win: string;
    loss: string;
    draw: string;
    opponentOnline: (name: string) => string;
    opponentOffline: (name: string) => string;
    battleEnded: string;
    rematchStatus: string;
    ready: string;
    waitConfirm: string;
    waitReconnect: string;
    waitOpponent: string;
    readyRematch: string;
    backToGym: string;
    allyTarget: string;
    enemyTarget: string;
    unspecified: string;
    allEnemies: string;
    allAllies: string;
    self: string;
    singleEnemy: string;
    singleAlly: string;
  };
  versus: {
    statusAria: string;
    room: string;
    seat: string;
    opponent: string;
    status: string;
    leftSeat: string;
    rightSeat: string;
    syncingSeat: string;
    connected: string;
    connecting: string;
    reconnecting: string;
    error: string;
    waitingOpponent: string;
    opponentDisconnected: string;
    finished: string;
    selecting: string;
    opening: string;
    rematch: string;
    moveSelect: string;
    ready: string;
    youReady: string;
    waitingRematch: string;
    waitingReconnect: string;
    youSubmitted: string;
    waitingYou: string;
    bothReady: string;
    waitingJoin: string;
    online: string;
    notJoined: string;
    offlineHeld: string;
  };
  tiers: Record<RpgSkillTier | "all", { label: string; shortLabel: string; range: string }>;
  targets: Record<RpgTarget, string>;
  elements: Record<RpgElement, ElementCopy>;
  statuses: Record<RpgStatusId, { label: string; shortLabel: string }>;
  pets: Record<string, PetCopy>;
  ai: Record<RpgAiDifficulty, { label: string; title: string; description: string }>;
  tickets: Record<string, { label: string; description: string; band: string }>;
};

export const RPG_TEXT: Record<RpgLanguage, RpgCopy> = {
  zh: {
    common: {
      close: "關閉",
      back: "返回",
      loading: "同步中…",
      retry: "重試",
      empty: "空",
      none: "無",
      all: "全",
      view: "查看",
      synced: "已同步",
      cached: "快取",
      reload: "重載",
      noImage: "NO IMAGE"
    },
    profile: {
      panelLabel: "個人設定",
      title: "個人與設定",
      subtitle: "先調整基本設定，再進收藏櫃或道館。",
      playerName: "玩家名稱",
      wallet: "錢包",
      demoData: "體驗資料",
      settings: "設定",
      languageHint: "語言可以隨時切換。",
      language: "語言",
      entry: "入口",
      entryHint: "收藏櫃和個人資料分開，不會混在同一頁。",
      cabinet: "收藏櫃",
      cabinetHint: "卡片展示、抽技能、前往插槽",
      gym: "道館",
      gymHint: "編輯隊伍與裝備技能",
      arena: "競技場",
      arenaHint: "進入即時對戰",
      interfaceLabel: "RPG 介面",
      profileButton: "個人與設定",
      profileBadge: "個人與設定",
      navLabel: "RPG 地點",
      village: "村莊",
      cards: "卡片",
      cardBag: "卡片背包",
      cardCabinet: "卡牌展示櫃",
      house: "個人房子",
      exitVillage: "回到村莊"
    },
    cabinet: {
      aria: "個人資料與錢包卡片",
      title: "收藏櫃",
      subtitle: "只顯示卡牌、抽取技能，技能卡可直接前往正確插槽",
      demoWalletTitle: "體驗用暫時錢包",
      demoWalletBody: "目前是提供給新手體驗抽技能、配裝、道館與競技場流程的暫時錢包，不是玩家正式資產。",
      walletCardsAria: "錢包卡片",
      showcase: "展示櫃",
      syncing: "同步藏品中…",
      readFailed: "讀取失敗",
      noMatchingCards: "沒有符合的卡片",
      noMatchingCardsHint: "切回全部或刷新卡冊。",
      drawAll: (count) => `一鍵抽獎 ${count}`,
      drawing: (done, total) => `抽獎中 ${done}/${total}`,
      allDrawn: "已全抽",
      elementDraw: (element, count) => `一鍵抽${element} ${count} 張`,
      elementAllDrawn: (element) => `${element}已全抽`,
      chooseElementForDraw: "選屬性後可在這裡一鍵抽單一屬性",
      tierTabsAria: "卡牌階級",
      cacheNotice: (reason) => `使用快取卡冊：${reason ?? "外部錢包 API 暫時失敗"}`,
      boundCards: "已綁定技能卡",
      boundCardsHintAll: "全部屬性，點按鈕跳到對應寵物插槽",
      boundCardsHintElement: (element) => `${element}屬性，點按鈕跳到對應寵物插槽`,
      noBoundCards: "還沒有這個屬性的綁定技能卡",
      noBoundCardsHint: "從錢包卡冊抽取技能後，卡片會永久記錄那個招式。",
      equipToSlot: (element) => `前往${element}插槽`,
      card: "卡片",
      waitingForSkillCard: "等待技能卡",
      cardsCount: (count) => `${count} 張`,
      updatedAt: (time) => `更新 ${time}`,
      notSynced: "尚未同步"
    },
    draw: {
      unbound: "尚未抽獎",
      bound: "已綁定技能",
      drawTitle: (element) => `${element}屬性技能抽獎`,
      drawReady: (element) => `點擊抽獎後，這張卡會永久綁定一個${element}屬性技能。`,
      drawVideo: "抽獎會先播放屬性開場影片，再揭露技能。",
      drawNoVideo: (element) => `${element}屬性開場影片待補，會直接揭露技能。`,
      drawSkill: "抽取技能",
      opening: (element) => `${element}屬性開場`,
      revealing: "技能揭露中",
      animationAria: (moveName) => `${moveName} 技能動畫`,
      damage: "傷害",
      energy: "能量",
      speed: "速度",
      animation: "動畫",
      idleTitle: "等待卡片轉券",
      pool: (element) => (element ? `${element}屬性池` : "五屬性技能池")
    },
    equip: {
      panelAria: "寵物卡片插槽",
      title: (petName) => `裝備技能：${petName}`,
      subtitle: (element) => `${element}屬性，總共 5 招；卡片技能佔槽，預設技能補滿剩餘格`,
      petSelectorAria: "選擇寵物",
      emptySlot: "空插槽",
      slot: (slot) => `插槽 ${slot}`,
      defaultSlot: (slot) => `預設 ${slot}`,
      inspectMove: (moveName) => `查看 ${moveName}`,
      remove: "卸下",
      noCards: (element) => `尚未有${element}屬性可插入卡片技能`,
      candidateCard: "候選卡片",
      equipped: "已裝備",
      skillName: (moveName) => `技能：${moveName}`,
      cardName: (cardName) => `卡片：${cardName}`,
      equipSkill: "插入技能",
      removeSkill: "卸下技能",
      removeSkillShort: "卸",
      equippedShort: "已裝",
      emptyDetail: "先在收藏櫃抽出技能，再回到這裡插入卡片。",
      skillLibrary: "技能裝備",
      libraryDescription: (element) => `${element}屬性，預設技能免費 / 抽取技能來自背包`,
      currentLoadout: (petName) => `${petName} 目前裝備`,
      defaultSource: "預設",
      cardSource: "卡片",
      noSkillCards: (element) => `尚未取得${element}屬性技能卡`
    },
    gym: {
      aria: "道館",
      title: "道館",
      subtitle: "AI 配對 / 房間碼真人對戰",
      tutorial: "教學",
      help: "先組 3v3 隊伍；點已上場寵物可編輯牠能使用的卡片技能。",
      workbenchAria: "道館技能與卡片插槽",
      aiDifficultyAria: "AI 難度",
      aiBattle: "AI 對戰",
      aiMatch: (label) => `AI 配對 / ${label}`,
      versusBattle: "真人對戰",
      connecting: "連線中",
      createRoom: "建立房間",
      roomCode: "房間代碼",
      joinRoom: "加入真人房",
      partyAria: "上場隊伍",
      partyTitle: "上場隊伍",
      formationAria: "道館站位",
      editingSlot: "卡槽編輯中",
      cardSlot: "卡槽",
      editCardSlotTitle: "編輯卡片插槽",
      editCardSlotAria: (petName) => `編輯 ${petName} 卡片插槽`,
      removeFromPartyTitle: "移出隊伍",
      removeFromPartyAria: (petName) => `將 ${petName} 移出隊伍`,
      emptyPartySlot: "空位",
      standby: "待命",
      editSlots: "編輯卡槽",
      fieldSlot: (index) => `出場 ${index + 1}`,
      formationSlots: [
        { label: "前排", shortLabel: "前" },
        { label: "後左", shortLabel: "左" },
        { label: "後右", shortLabel: "右" }
      ]
    },
    battle: {
      versusWaitingAria: "真人道館等待",
      versusGym: "真人道館",
      creatingRoom: "建立房間中",
      reconnecting: "重新連線中。",
      connecting: "CONNECTING",
      waitingPlayer: "等待另一位玩家加入。",
      arenaAria: "道館對戰",
      aiGym: "AI 道館",
      localGym: "本地道館",
      turn: (turn) => `TURN ${turn}`,
      battleSettings: "戰鬥設定",
      exitVersus: "退出真人道館",
      exitAi: "退出 AI 道館",
      ally: "我方",
      enemy: "敵方",
      opponentTurn: "對手回合",
      enemyTurn: "敵方回合",
      waitingActor: "等待行動者",
      acting: (name) => `${name} 行動中`,
      waitingOpponentMove: "等待對手選擇招式。",
      aiChoosingMove: "AI 正在選擇招式。",
      noTarget: "尚未選擇",
      chooseSkillThenTarget: "點技能後再點場上目標",
      selectedMove: (moveName, targetName) => `已選 ${moveName} → ${targetName}`,
      availableEnergy: (available, round) => `可分配 ${available}/${round} EN`,
      reselect: "重選",
      selected: "已選",
      target: (targetName) => `目標：${targetName}`,
      commandStatus: "指令狀態",
      submitMoves: "送出選招",
      execute: "執行",
      actionStatusResync: "真人道館重新同步中",
      actionStatusSubmitted: "已送出，等待同步",
      actionStatusAllocated: (spent, round) => `已分配 ${spent}/${round} EN`,
      actionStatusChoose: "選擇本回合行動",
      actionStatusWaiting: "等待對手行動",
      actionDetailCommand: (selected, living) => `每隻寵物最多一招，可保留未用 EN；已選 ${selected}/${living}`,
      actionDetailActing: (name) => `${name} 正在行動`,
      actionDetailWaiting: "等待下一個行動階段",
      energyTitle: "本回合能量",
      energyHint: "雙方都行動完才進下一回合，最高 10",
      energyAria: (energy) => `目前能量 ${energy}/10`,
      energyPhase: (side, actor, energy, turnEnergy) => `${side}階段：${actor} 帶頭行動，可用 ${energy}/${turnEnergy} EN`,
      energyWaiting: (side) => `${side}階段等待行動者`,
      resultAria: "戰鬥結果",
      resultVersus: "真人道館結果",
      resultAi: "AI 道館結果",
      win: "勝利",
      loss: "敗北",
      draw: "平手",
      opponentOnline: (name) => `${name}在線`,
      opponentOffline: (name) => `${name}離線，房間保留中`,
      battleEnded: "戰鬥已結束",
      rematchStatus: "再戰準備",
      ready: "你已準備",
      waitConfirm: "等待確認",
      waitReconnect: "等待對手重連",
      waitOpponent: "等待對手",
      readyRematch: "準備再戰",
      backToGym: "回道館",
      allyTarget: "我方目標",
      enemyTarget: "敵方目標",
      unspecified: "未指定",
      allEnemies: "敵方全體",
      allAllies: "我方全體",
      self: "自身",
      singleEnemy: "單體敵方",
      singleAlly: "單體我方"
    },
    versus: {
      statusAria: "真人對戰狀態",
      room: "房間",
      seat: "席位",
      opponent: "對手",
      status: "狀態",
      leftSeat: "左席",
      rightSeat: "右席",
      syncingSeat: "席位同步中",
      connected: "已連線",
      connecting: "連線中",
      reconnecting: "重連中",
      error: "連線錯誤",
      waitingOpponent: "等待對手",
      opponentDisconnected: "對手離線",
      finished: "結算",
      selecting: "選招中",
      opening: "開局",
      rematch: "再戰",
      moveSelect: "選招",
      ready: "就位",
      youReady: "你已準備",
      waitingRematch: "等待再戰",
      waitingReconnect: "等待重連",
      youSubmitted: "你已送出",
      waitingYou: "待你選招",
      bothReady: "雙方就位",
      waitingJoin: "等待加入",
      online: "在線",
      notJoined: "未加入",
      offlineHeld: "離線保留"
    },
    tiers: {
      all: { label: "全部櫃", shortLabel: "全部", range: "全部價位" },
      basic: { label: "初階", shortLabel: "初", range: "$0-99" },
      intermediate: { label: "中階", shortLabel: "中", range: "$100-499" },
      ultimate: { label: "高階", shortLabel: "高", range: "$500+" }
    },
    targets: {
      singleEnemy: "單體",
      allEnemies: "敵全體",
      self: "自身",
      singleAlly: "隊友",
      allAllies: "我方全體"
    },
    elements: {
      water: { label: "水", shortLabel: "水", role: "續航、淨化、節奏控制" },
      fire: { label: "火", shortLabel: "火", role: "爆發、燃燒、壓低血線" },
      grass: { label: "草", shortLabel: "草", role: "回復、毒素、反制" },
      dark: { label: "暗", shortLabel: "暗", role: "腐蝕、暈眩、節奏壓迫" },
      light: { label: "光", shortLabel: "光", role: "護盾、淨化、精準打擊" }
    },
    statuses: {
      burn: { label: "燃燒", shortLabel: "燃" },
      poison: { label: "中毒", shortLabel: "毒" },
      stun: { label: "暈眩", shortLabel: "暈" },
      guard: { label: "防護", shortLabel: "護" },
      regen: { label: "再生", shortLabel: "癒" }
    },
    pets: {
      pet_water_tidefin: { name: "潮鰭", title: "潮汐守衛" },
      pet_fire_emberfox: { name: "燼狐", title: "熾焰追獵者" },
      pet_grass_mossling: { name: "苔鹿", title: "森脈療護者" },
      pet_dark_nyxcat: { name: "夜貓", title: "暗紋干擾者" },
      pet_light_lumibun: { name: "曜兔", title: "稜光守序者" }
    },
    ai: {
      normal: { label: "普通", title: "見習道館", description: "基本招式組，適合確認隊伍站位與屬性克制。" },
      hard: { label: "困難", title: "精英道館", description: "中階群攻與控制招式更多，會更積極壓低血線。" },
      leader: { label: "館主", title: "五屬館主", description: "高階招式與全隊支援都會出現，是目前 AI 道館最高挑戰。" }
    },
    tickets: {
      ticket_basic_card: { label: "初階技能卡券", description: "由便宜卡片轉成的抽獎券，只抽初階技能。", band: "便宜卡片" },
      ticket_intermediate_card: { label: "中階技能卡券", description: "由中價卡片轉成的抽獎券，只抽中階技能。", band: "中價卡片" },
      ticket_ultimate_card: { label: "高階技能卡券", description: "由高價卡片轉成的抽獎券，只抽高階技能。", band: "高價卡片" },
      ticket_ten_card: { label: "十連技能卡券", description: "由高價十連卡片轉成的抽獎券，混合抽取並保證至少一張高階技能。", band: "高價十連卡" }
    }
  },
  en: {
    common: {
      close: "Close",
      back: "Back",
      loading: "Syncing...",
      retry: "Retry",
      empty: "Empty",
      none: "None",
      all: "All",
      view: "View",
      synced: "Synced",
      cached: "Cached",
      reload: "Reload",
      noImage: "NO IMAGE"
    },
    profile: {
      panelLabel: "Profile settings",
      title: "Profile & Settings",
      subtitle: "Adjust your setup, then open the cabinet or gym.",
      playerName: "Player Name",
      wallet: "Wallet",
      demoData: "Demo data",
      settings: "Settings",
      languageHint: "You can change language anytime.",
      language: "Language",
      entry: "Destinations",
      entryHint: "The cabinet is separate from profile settings.",
      cabinet: "Cabinet",
      cabinetHint: "View cards, draw skills, jump to slots",
      gym: "Gym",
      gymHint: "Edit your team and equipped skills",
      arena: "Arena",
      arenaHint: "Enter real-time battle",
      interfaceLabel: "RPG interface",
      profileButton: "Profile & Settings",
      profileBadge: "Profile & Settings",
      navLabel: "RPG places",
      village: "Village",
      cards: "Cards",
      cardBag: "Card Bag",
      cardCabinet: "Card Cabinet",
      house: "Personal House",
      exitVillage: "Back to Village"
    },
    cabinet: {
      aria: "Profile and wallet cards",
      title: "Cabinet",
      subtitle: "Show cards, draw skills, and jump directly to the right slots.",
      demoWalletTitle: "Temporary Demo Wallet",
      demoWalletBody: "This is a temporary wallet for testing skill draws, loadouts, gym, and arena flow. It is not the player's official asset wallet.",
      walletCardsAria: "Wallet cards",
      showcase: "Showcase",
      syncing: "Syncing collection...",
      readFailed: "Load failed",
      noMatchingCards: "No matching cards",
      noMatchingCardsHint: "Switch back to All or reload the cabinet.",
      drawAll: (count) => `Draw All ${count}`,
      drawing: (done, total) => `Drawing ${done}/${total}`,
      allDrawn: "All Drawn",
      elementDraw: (element, count) => `Draw ${element} ${count}`,
      elementAllDrawn: (element) => `${element} Done`,
      chooseElementForDraw: "Choose an element to draw only that element.",
      tierTabsAria: "Card tiers",
      cacheNotice: (reason) => `Using cached cards: ${reason ?? "external wallet API is temporarily unavailable"}`,
      boundCards: "Bound Skill Cards",
      boundCardsHintAll: "All elements. Use the button to jump to the matching pet slot.",
      boundCardsHintElement: (element) => `${element} element. Use the button to jump to the matching pet slot.`,
      noBoundCards: "No bound skill cards for this element yet",
      noBoundCardsHint: "After drawing skills from wallet cards, each card keeps its assigned move.",
      equipToSlot: (element) => `Go to ${element} Slots`,
      card: "Card",
      waitingForSkillCard: "Waiting for skill cards",
      cardsCount: (count) => `${count} cards`,
      updatedAt: (time) => `Updated ${time}`,
      notSynced: "Not synced"
    },
    draw: {
      unbound: "Not drawn",
      bound: "Skill Bound",
      drawTitle: (element) => `${element} Skill Draw`,
      drawReady: (element) => `After drawing, this card will permanently bind one ${element} skill.`,
      drawVideo: "The draw plays an element intro before revealing the skill.",
      drawNoVideo: (element) => `${element} intro video is missing, so the skill will reveal directly.`,
      drawSkill: "Draw Skill",
      opening: (element) => `${element} Intro`,
      revealing: "Revealing Skill",
      animationAria: (moveName) => `${moveName} skill animation`,
      damage: "Damage",
      energy: "Energy",
      speed: "Speed",
      animation: "Animation",
      idleTitle: "Waiting for card conversion",
      pool: (element) => (element ? `${element} Pool` : "Five-Element Skill Pool")
    },
    equip: {
      panelAria: "Pet card slots",
      title: (petName) => `Equip Skills: ${petName}`,
      subtitle: (element) => `${element}. Total 5 moves; card skills take slots and default skills fill the rest.`,
      petSelectorAria: "Choose pet",
      emptySlot: "Empty Slot",
      slot: (slot) => `Slot ${slot}`,
      defaultSlot: (slot) => `Default ${slot}`,
      inspectMove: (moveName) => `Inspect ${moveName}`,
      remove: "Remove",
      noCards: (element) => `No ${element} cards available for slotting yet`,
      candidateCard: "Candidate Card",
      equipped: "Equipped",
      skillName: (moveName) => `Skill: ${moveName}`,
      cardName: (cardName) => `Card: ${cardName}`,
      equipSkill: "Insert Skill",
      removeSkill: "Remove Skill",
      removeSkillShort: "Remove",
      equippedShort: "Equipped",
      emptyDetail: "Draw skills in the cabinet first, then return here to slot cards.",
      skillLibrary: "Skill Loadout",
      libraryDescription: (element) => `${element}. Default skills are free; drawn skills come from your bag.`,
      currentLoadout: (petName) => `${petName} Loadout`,
      defaultSource: "Default",
      cardSource: "Card",
      noSkillCards: (element) => `No ${element} skill cards yet`
    },
    gym: {
      aria: "Gym",
      title: "Gym",
      subtitle: "AI matchmaking / player rooms by code",
      tutorial: "Guide",
      help: "Build a 3v3 team first. Click a deployed pet to edit the card skills it can use.",
      workbenchAria: "Gym skills and card slots",
      aiDifficultyAria: "AI difficulty",
      aiBattle: "AI Battle",
      aiMatch: (label) => `AI Match / ${label}`,
      versusBattle: "Player Battle",
      connecting: "Connecting",
      createRoom: "Create Room",
      roomCode: "Room Code",
      joinRoom: "Join Room",
      partyAria: "Battle Team",
      partyTitle: "Battle Team",
      formationAria: "Gym formation",
      editingSlot: "Editing slots",
      cardSlot: "Slots",
      editCardSlotTitle: "Edit card slots",
      editCardSlotAria: (petName) => `Edit ${petName} card slots`,
      removeFromPartyTitle: "Remove from team",
      removeFromPartyAria: (petName) => `Remove ${petName} from team`,
      emptyPartySlot: "Empty",
      standby: "Standby",
      editSlots: "Edit Slots",
      fieldSlot: (index) => `Field ${index + 1}`,
      formationSlots: [
        { label: "Front", shortLabel: "F" },
        { label: "Back Left", shortLabel: "L" },
        { label: "Back Right", shortLabel: "R" }
      ]
    },
    battle: {
      versusWaitingAria: "Waiting for player gym",
      versusGym: "Player Gym",
      creatingRoom: "Creating room",
      reconnecting: "Reconnecting.",
      connecting: "CONNECTING",
      waitingPlayer: "Waiting for another player.",
      arenaAria: "Gym battle",
      aiGym: "AI Gym",
      localGym: "Local Gym",
      turn: (turn) => `TURN ${turn}`,
      battleSettings: "Battle Settings",
      exitVersus: "Exit Player Gym",
      exitAi: "Exit AI Gym",
      ally: "Ally",
      enemy: "Enemy",
      opponentTurn: "Opponent Turn",
      enemyTurn: "Enemy Turn",
      waitingActor: "Waiting for actor",
      acting: (name) => `${name} acting`,
      waitingOpponentMove: "Waiting for opponent moves.",
      aiChoosingMove: "AI is choosing moves.",
      noTarget: "No target",
      chooseSkillThenTarget: "Pick a skill, then pick a target",
      selectedMove: (moveName, targetName) => `Selected ${moveName} -> ${targetName}`,
      availableEnergy: (available, round) => `Available ${available}/${round} EN`,
      reselect: "Reselect",
      selected: "Selected",
      target: (targetName) => `Target: ${targetName}`,
      commandStatus: "Command Status",
      submitMoves: "Submit Moves",
      execute: "Execute",
      actionStatusResync: "Player gym resyncing",
      actionStatusSubmitted: "Submitted, waiting for sync",
      actionStatusAllocated: (spent, round) => `Allocated ${spent}/${round} EN`,
      actionStatusChoose: "Choose this turn's actions",
      actionStatusWaiting: "Waiting for opponent action",
      actionDetailCommand: (selected, living) => `One move per pet; unused EN can be kept. Selected ${selected}/${living}`,
      actionDetailActing: (name) => `${name} is acting`,
      actionDetailWaiting: "Waiting for the next action phase",
      energyTitle: "Turn Energy",
      energyHint: "The next turn begins after both sides act. Max 10.",
      energyAria: (energy) => `Current energy ${energy}/10`,
      energyPhase: (side, actor, energy, turnEnergy) => `${side} phase: ${actor} leads, ${energy}/${turnEnergy} EN available`,
      energyWaiting: (side) => `${side} phase waiting for actor`,
      resultAria: "Battle result",
      resultVersus: "Player Gym Result",
      resultAi: "AI Gym Result",
      win: "Victory",
      loss: "Defeat",
      draw: "Draw",
      opponentOnline: (name) => `${name} online`,
      opponentOffline: (name) => `${name} offline, room held`,
      battleEnded: "Battle ended",
      rematchStatus: "Rematch Ready",
      ready: "You are ready",
      waitConfirm: "Waiting for confirmation",
      waitReconnect: "Waiting for opponent reconnect",
      waitOpponent: "Waiting for opponent",
      readyRematch: "Ready Rematch",
      backToGym: "Back to Gym",
      allyTarget: "Ally Target",
      enemyTarget: "Enemy Target",
      unspecified: "Unspecified",
      allEnemies: "All Enemies",
      allAllies: "All Allies",
      self: "Self",
      singleEnemy: "Single Enemy",
      singleAlly: "Single Ally"
    },
    versus: {
      statusAria: "Player battle status",
      room: "Room",
      seat: "Seat",
      opponent: "Opponent",
      status: "Status",
      leftSeat: "Left Seat",
      rightSeat: "Right Seat",
      syncingSeat: "Syncing Seat",
      connected: "Connected",
      connecting: "Connecting",
      reconnecting: "Reconnecting",
      error: "Connection Error",
      waitingOpponent: "Waiting Opponent",
      opponentDisconnected: "Opponent Offline",
      finished: "Result",
      selecting: "Selecting",
      opening: "Opening",
      rematch: "Rematch",
      moveSelect: "Move Select",
      ready: "Ready",
      youReady: "You are ready",
      waitingRematch: "Waiting rematch",
      waitingReconnect: "Waiting reconnect",
      youSubmitted: "You submitted",
      waitingYou: "Your move",
      bothReady: "Both ready",
      waitingJoin: "Waiting join",
      online: "Online",
      notJoined: "Not joined",
      offlineHeld: "Offline held"
    },
    tiers: {
      all: { label: "All Cabinet", shortLabel: "All", range: "All Prices" },
      basic: { label: "Basic", shortLabel: "B", range: "$0-99" },
      intermediate: { label: "Advanced", shortLabel: "A", range: "$100-499" },
      ultimate: { label: "Rare", shortLabel: "R", range: "$500+" }
    },
    targets: {
      singleEnemy: "Single",
      allEnemies: "All Enemies",
      self: "Self",
      singleAlly: "Ally",
      allAllies: "All Allies"
    },
    elements: {
      water: { label: "Water", shortLabel: "W", role: "Sustain, cleanse, tempo control" },
      fire: { label: "Fire", shortLabel: "F", role: "Burst, burn, pressure" },
      grass: { label: "Grass", shortLabel: "G", role: "Healing, poison, counterplay" },
      dark: { label: "Dark", shortLabel: "D", role: "Corrosion, stun, tempo pressure" },
      light: { label: "Light", shortLabel: "L", role: "Shield, cleanse, precision" }
    },
    statuses: {
      burn: { label: "Burn", shortLabel: "BRN" },
      poison: { label: "Poison", shortLabel: "PSN" },
      stun: { label: "Stun", shortLabel: "STN" },
      guard: { label: "Guard", shortLabel: "GRD" },
      regen: { label: "Regen", shortLabel: "REG" }
    },
    pets: {
      pet_water_tidefin: { name: "Tidefin", title: "Tidal Guard" },
      pet_fire_emberfox: { name: "Emberfox", title: "Flame Hunter" },
      pet_grass_mossling: { name: "Mossling", title: "Forest Mender" },
      pet_dark_nyxcat: { name: "Nyxcat", title: "Shadow Disruptor" },
      pet_light_lumibun: { name: "Lumibun", title: "Prism Keeper" }
    },
    ai: {
      normal: { label: "Normal", title: "Apprentice Gym", description: "Basic move sets for testing formation and element counters." },
      hard: { label: "Hard", title: "Elite Gym", description: "More advanced area and control moves, with stronger HP pressure." },
      leader: { label: "Leader", title: "Five-Element Leader", description: "The current hardest AI gym, using rare moves and team support." }
    },
    tickets: {
      ticket_basic_card: { label: "Basic Skill Ticket", description: "Converted from low-price cards; draws basic skills only.", band: "Low-Price Card" },
      ticket_intermediate_card: { label: "Advanced Skill Ticket", description: "Converted from mid-price cards; draws advanced skills only.", band: "Mid-Price Card" },
      ticket_ultimate_card: { label: "Rare Skill Ticket", description: "Converted from high-price cards; draws rare skills only.", band: "High-Price Card" },
      ticket_ten_card: { label: "Ten-Draw Skill Ticket", description: "Converted from a high-price ten-draw card; mixed pool with at least one rare skill.", band: "High-Price Ten-Draw" }
    }
  },
  ko: {
    common: {
      close: "닫기",
      back: "뒤로",
      loading: "동기화 중...",
      retry: "다시 시도",
      empty: "비어 있음",
      none: "없음",
      all: "전체",
      view: "보기",
      synced: "동기화됨",
      cached: "캐시",
      reload: "새로고침",
      noImage: "NO IMAGE"
    },
    profile: {
      panelLabel: "프로필 설정",
      title: "프로필 및 설정",
      subtitle: "기본 설정을 조정한 뒤 수집장이나 도장으로 이동하세요.",
      playerName: "플레이어 이름",
      wallet: "지갑",
      demoData: "체험 데이터",
      settings: "설정",
      languageHint: "언어는 언제든 변경할 수 있습니다.",
      language: "언어",
      entry: "이동 메뉴",
      entryHint: "수집장은 프로필 설정과 분리되어 있습니다.",
      cabinet: "수집장",
      cabinetHint: "카드 보기, 스킬 추첨, 슬롯 이동",
      gym: "도장",
      gymHint: "팀과 장착 스킬 편집",
      arena: "경기장",
      arenaHint: "실시간 전투 입장",
      interfaceLabel: "RPG 인터페이스",
      profileButton: "프로필 및 설정",
      profileBadge: "프로필 및 설정",
      navLabel: "RPG 장소",
      village: "마을",
      cards: "카드",
      cardBag: "카드 가방",
      cardCabinet: "카드 진열장",
      house: "개인 집",
      exitVillage: "마을로 돌아가기"
    },
    cabinet: {
      aria: "프로필 및 지갑 카드",
      title: "수집장",
      subtitle: "카드를 보고 스킬을 추첨한 뒤 올바른 슬롯으로 이동합니다.",
      demoWalletTitle: "임시 체험 지갑",
      demoWalletBody: "스킬 추첨, 장착, 도장, 경기장 흐름을 먼저 체험하기 위한 임시 지갑입니다. 플레이어의 공식 자산 지갑이 아닙니다.",
      walletCardsAria: "지갑 카드",
      showcase: "전시함",
      syncing: "컬렉션 동기화 중...",
      readFailed: "불러오기 실패",
      noMatchingCards: "조건에 맞는 카드 없음",
      noMatchingCardsHint: "전체로 바꾸거나 카드함을 새로고침하세요.",
      drawAll: (count) => `전체 추첨 ${count}`,
      drawing: (done, total) => `추첨 중 ${done}/${total}`,
      allDrawn: "모두 추첨됨",
      elementDraw: (element, count) => `${element} 추첨 ${count}`,
      elementAllDrawn: (element) => `${element} 완료`,
      chooseElementForDraw: "속성을 선택하면 해당 속성만 한 번에 추첨할 수 있습니다.",
      tierTabsAria: "카드 등급",
      cacheNotice: (reason) => `캐시 카드함 사용: ${reason ?? "외부 지갑 API를 일시적으로 사용할 수 없습니다"}`,
      boundCards: "귀속 스킬 카드",
      boundCardsHintAll: "전체 속성입니다. 버튼을 눌러 맞는 펫 슬롯으로 이동하세요.",
      boundCardsHintElement: (element) => `${element} 속성입니다. 버튼을 눌러 맞는 펫 슬롯으로 이동하세요.`,
      noBoundCards: "이 속성의 귀속 스킬 카드가 아직 없습니다",
      noBoundCardsHint: "지갑 카드에서 스킬을 추첨하면 그 카드에 스킬이 영구 기록됩니다.",
      equipToSlot: (element) => `${element} 슬롯으로 이동`,
      card: "카드",
      waitingForSkillCard: "스킬 카드 대기 중",
      cardsCount: (count) => `${count}장`,
      updatedAt: (time) => `업데이트 ${time}`,
      notSynced: "아직 동기화 안 됨"
    },
    draw: {
      unbound: "아직 추첨 전",
      bound: "스킬 귀속됨",
      drawTitle: (element) => `${element} 스킬 추첨`,
      drawReady: (element) => `추첨하면 이 카드는 ${element} 스킬 하나에 영구 귀속됩니다.`,
      drawVideo: "추첨 시 속성 오프닝 후 스킬이 공개됩니다.",
      drawNoVideo: (element) => `${element} 오프닝 영상이 없어 바로 공개됩니다.`,
      drawSkill: "스킬 추첨",
      opening: (element) => `${element} 오프닝`,
      revealing: "스킬 공개 중",
      animationAria: (moveName) => `${moveName} 스킬 애니메이션`,
      damage: "피해",
      energy: "에너지",
      speed: "속도",
      animation: "애니메이션",
      idleTitle: "카드 전환 대기 중",
      pool: (element) => (element ? `${element} 풀` : "오속성 스킬 풀")
    },
    equip: {
      panelAria: "펫 카드 슬롯",
      title: (petName) => `스킬 장착: ${petName}`,
      subtitle: (element) => `${element}. 총 5개 스킬; 카드 스킬이 슬롯을 차지하고 기본 스킬이 남은 칸을 채웁니다.`,
      petSelectorAria: "펫 선택",
      emptySlot: "빈 슬롯",
      slot: (slot) => `슬롯 ${slot}`,
      defaultSlot: (slot) => `기본 ${slot}`,
      inspectMove: (moveName) => `${moveName} 보기`,
      remove: "해제",
      noCards: (element) => `장착할 수 있는 ${element} 카드가 아직 없습니다`,
      candidateCard: "후보 카드",
      equipped: "장착됨",
      skillName: (moveName) => `스킬: ${moveName}`,
      cardName: (cardName) => `카드: ${cardName}`,
      equipSkill: "스킬 삽입",
      removeSkill: "스킬 해제",
      removeSkillShort: "해제",
      equippedShort: "장착",
      emptyDetail: "먼저 수집장에서 스킬을 추첨한 뒤 여기로 돌아와 카드를 장착하세요.",
      skillLibrary: "스킬 장착",
      libraryDescription: (element) => `${element}. 기본 스킬은 무료이고 추첨 스킬은 가방에서 사용합니다.`,
      currentLoadout: (petName) => `${petName} 현재 장착`,
      defaultSource: "기본",
      cardSource: "카드",
      noSkillCards: (element) => `${element} 스킬 카드가 아직 없습니다`
    },
    gym: {
      aria: "도장",
      title: "도장",
      subtitle: "AI 매칭 / 방 코드 플레이어 대전",
      tutorial: "가이드",
      help: "먼저 3v3 팀을 구성하세요. 출전 펫을 클릭하면 사용할 카드 스킬을 편집할 수 있습니다.",
      workbenchAria: "도장 스킬 및 카드 슬롯",
      aiDifficultyAria: "AI 난이도",
      aiBattle: "AI 대전",
      aiMatch: (label) => `AI 매칭 / ${label}`,
      versusBattle: "플레이어 대전",
      connecting: "연결 중",
      createRoom: "방 만들기",
      roomCode: "방 코드",
      joinRoom: "플레이어 방 참가",
      partyAria: "출전 팀",
      partyTitle: "출전 팀",
      formationAria: "도장 배치",
      editingSlot: "슬롯 편집 중",
      cardSlot: "슬롯",
      editCardSlotTitle: "카드 슬롯 편집",
      editCardSlotAria: (petName) => `${petName} 카드 슬롯 편집`,
      removeFromPartyTitle: "팀에서 제거",
      removeFromPartyAria: (petName) => `${petName} 팀에서 제거`,
      emptyPartySlot: "빈 자리",
      standby: "대기",
      editSlots: "슬롯 편집",
      fieldSlot: (index) => `출전 ${index + 1}`,
      formationSlots: [
        { label: "전열", shortLabel: "전" },
        { label: "후좌", shortLabel: "좌" },
        { label: "후우", shortLabel: "우" }
      ]
    },
    battle: {
      versusWaitingAria: "플레이어 도장 대기",
      versusGym: "플레이어 도장",
      creatingRoom: "방 생성 중",
      reconnecting: "재연결 중.",
      connecting: "CONNECTING",
      waitingPlayer: "다른 플레이어를 기다리는 중.",
      arenaAria: "도장 전투",
      aiGym: "AI 도장",
      localGym: "로컬 도장",
      turn: (turn) => `TURN ${turn}`,
      battleSettings: "전투 설정",
      exitVersus: "플레이어 도장 나가기",
      exitAi: "AI 도장 나가기",
      ally: "아군",
      enemy: "적",
      opponentTurn: "상대 턴",
      enemyTurn: "적 턴",
      waitingActor: "행동자 대기",
      acting: (name) => `${name} 행동 중`,
      waitingOpponentMove: "상대의 스킬 선택을 기다리는 중.",
      aiChoosingMove: "AI가 스킬을 선택 중입니다.",
      noTarget: "대상 없음",
      chooseSkillThenTarget: "스킬을 고른 뒤 대상을 선택하세요",
      selectedMove: (moveName, targetName) => `${moveName} 선택 -> ${targetName}`,
      availableEnergy: (available, round) => `사용 가능 ${available}/${round} EN`,
      reselect: "다시 선택",
      selected: "선택됨",
      target: (targetName) => `대상: ${targetName}`,
      commandStatus: "명령 상태",
      submitMoves: "선택 제출",
      execute: "실행",
      actionStatusResync: "플레이어 도장 재동기화 중",
      actionStatusSubmitted: "제출 완료, 동기화 대기",
      actionStatusAllocated: (spent, round) => `${spent}/${round} EN 배분됨`,
      actionStatusChoose: "이번 턴 행동 선택",
      actionStatusWaiting: "상대 행동 대기",
      actionDetailCommand: (selected, living) => `펫마다 스킬 하나; 남은 EN은 보존 가능. 선택 ${selected}/${living}`,
      actionDetailActing: (name) => `${name} 행동 중`,
      actionDetailWaiting: "다음 행동 단계 대기",
      energyTitle: "이번 턴 에너지",
      energyHint: "양쪽이 모두 행동해야 다음 턴으로 넘어갑니다. 최대 10.",
      energyAria: (energy) => `현재 에너지 ${energy}/10`,
      energyPhase: (side, actor, energy, turnEnergy) => `${side} 단계: ${actor} 선행, 사용 가능 ${energy}/${turnEnergy} EN`,
      energyWaiting: (side) => `${side} 단계 행동자 대기`,
      resultAria: "전투 결과",
      resultVersus: "플레이어 도장 결과",
      resultAi: "AI 도장 결과",
      win: "승리",
      loss: "패배",
      draw: "무승부",
      opponentOnline: (name) => `${name} 온라인`,
      opponentOffline: (name) => `${name} 오프라인, 방 유지 중`,
      battleEnded: "전투 종료",
      rematchStatus: "재대전 준비",
      ready: "준비 완료",
      waitConfirm: "확인 대기",
      waitReconnect: "상대 재연결 대기",
      waitOpponent: "상대 대기",
      readyRematch: "재대전 준비",
      backToGym: "도장으로",
      allyTarget: "아군 대상",
      enemyTarget: "적 대상",
      unspecified: "미지정",
      allEnemies: "적 전체",
      allAllies: "아군 전체",
      self: "자신",
      singleEnemy: "단일 적",
      singleAlly: "단일 아군"
    },
    versus: {
      statusAria: "플레이어 대전 상태",
      room: "방",
      seat: "좌석",
      opponent: "상대",
      status: "상태",
      leftSeat: "왼쪽 좌석",
      rightSeat: "오른쪽 좌석",
      syncingSeat: "좌석 동기화 중",
      connected: "연결됨",
      connecting: "연결 중",
      reconnecting: "재연결 중",
      error: "연결 오류",
      waitingOpponent: "상대 대기",
      opponentDisconnected: "상대 오프라인",
      finished: "결과",
      selecting: "선택 중",
      opening: "시작",
      rematch: "재대전",
      moveSelect: "스킬 선택",
      ready: "준비",
      youReady: "준비 완료",
      waitingRematch: "재대전 대기",
      waitingReconnect: "재연결 대기",
      youSubmitted: "제출 완료",
      waitingYou: "내 선택 대기",
      bothReady: "양쪽 준비",
      waitingJoin: "참가 대기",
      online: "온라인",
      notJoined: "미참가",
      offlineHeld: "오프라인 유지"
    },
    tiers: {
      all: { label: "전체함", shortLabel: "전체", range: "전체 가격" },
      basic: { label: "기본", shortLabel: "기", range: "$0-99" },
      intermediate: { label: "중급", shortLabel: "중", range: "$100-499" },
      ultimate: { label: "고급", shortLabel: "고", range: "$500+" }
    },
    targets: {
      singleEnemy: "단일",
      allEnemies: "적 전체",
      self: "자신",
      singleAlly: "아군",
      allAllies: "아군 전체"
    },
    elements: {
      water: { label: "물", shortLabel: "물", role: "유지력, 정화, 템포 제어" },
      fire: { label: "불", shortLabel: "불", role: "폭발력, 화상, 압박" },
      grass: { label: "풀", shortLabel: "풀", role: "회복, 독, 반격" },
      dark: { label: "어둠", shortLabel: "암", role: "부식, 기절, 템포 압박" },
      light: { label: "빛", shortLabel: "빛", role: "보호막, 정화, 정밀 타격" }
    },
    statuses: {
      burn: { label: "화상", shortLabel: "화" },
      poison: { label: "중독", shortLabel: "독" },
      stun: { label: "기절", shortLabel: "기" },
      guard: { label: "방호", shortLabel: "방" },
      regen: { label: "재생", shortLabel: "재" }
    },
    pets: {
      pet_water_tidefin: { name: "조아핀", title: "조수 수호자" },
      pet_fire_emberfox: { name: "불씨여우", title: "화염 추적자" },
      pet_grass_mossling: { name: "이끼사슴", title: "숲맥 치유자" },
      pet_dark_nyxcat: { name: "밤고양이", title: "암문 교란자" },
      pet_light_lumibun: { name: "빛토끼", title: "프리즘 수호자" }
    },
    ai: {
      normal: { label: "보통", title: "견습 도장", description: "기본 스킬 구성으로 배치와 속성 상성을 확인하기 좋습니다." },
      hard: { label: "어려움", title: "엘리트 도장", description: "중급 광역과 제어 스킬이 많아 체력 압박이 더 강합니다." },
      leader: { label: "관장", title: "오속 관장", description: "고급 스킬과 팀 지원까지 사용하는 현재 최고 난이도 AI 도장입니다." }
    },
    tickets: {
      ticket_basic_card: { label: "기본 스킬 티켓", description: "저가 카드에서 전환되며 기본 스킬만 추첨합니다.", band: "저가 카드" },
      ticket_intermediate_card: { label: "중급 스킬 티켓", description: "중가 카드에서 전환되며 중급 스킬만 추첨합니다.", band: "중가 카드" },
      ticket_ultimate_card: { label: "고급 스킬 티켓", description: "고가 카드에서 전환되며 고급 스킬만 추첨합니다.", band: "고가 카드" },
      ticket_ten_card: { label: "10연 스킬 티켓", description: "고가 10연 카드에서 전환되며 혼합 추첨과 고급 스킬 최소 1장을 보장합니다.", band: "고가 10연 카드" }
    }
  }
};

const MOVE_STYLE_COPY: Record<RpgLanguage, Record<RpgMove["animation"]["style"], string>> = {
  zh: {
    strike: "斬擊",
    projectile: "飛射",
    beam: "光束",
    burst: "爆發",
    rain: "落雨",
    aura: "靈氣",
    wave: "掃波",
    field: "結界",
    summon: "召喚",
    card: "卡牌"
  },
  en: {
    strike: "Strike",
    projectile: "Shot",
    beam: "Beam",
    burst: "Burst",
    rain: "Rain",
    aura: "Aura",
    wave: "Wave",
    field: "Field",
    summon: "Summon",
    card: "Card"
  },
  ko: {
    strike: "참격",
    projectile: "투사체",
    beam: "광선",
    burst: "폭발",
    rain: "낙하",
    aura: "오라",
    wave: "파동",
    field: "결계",
    summon: "소환",
    card: "카드"
  }
};

export function normalizeRpgLanguage(value: string | null | undefined): RpgLanguage | null {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("ko")) return "ko";
  if (normalized.startsWith("en")) return "en";
  return null;
}

export function getCurrentRpgLanguage(): RpgLanguage {
  if (typeof window === "undefined") return "zh";
  const params = new URLSearchParams(window.location.search);
  return normalizeRpgLanguage(params.get("lang")) ?? normalizeRpgLanguage(readStoredRpgLanguage()) ?? normalizeRpgLanguage(window.navigator.language) ?? "zh";
}

function readStoredRpgLanguage() {
  try {
    return window.localStorage?.getItem(RPG_LANGUAGE_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

const RPG_NOTICE_COPY = {
  zh: {
    waitingOpponent: "等待對手加入。",
    battleFinishedAwaiting: "戰鬥結束，等待再戰或離開。",
    opponentDisconnected: "對手連線中斷，保留戰鬥並等待重連。",
    noElementPet: (element: string) => `還沒有${element}屬性寵物可以插卡。`,
    switchedCardSlot: (pet: string) => `已切到${pet}的卡片插槽。`,
    walletStale: "外部錢包 API 暫時失敗，現在顯示已同步過的本地卡片。",
    walletFallback: "錢包卡片來源使用 fallback。",
    walletReadFailed: "讀取錢包卡片失敗。",
    partyFull: "隊伍已滿，先移出一格再加入。",
    wrongPetElement: (move: string, element: string) => `${move} 只能裝備到${element}屬性寵物。`,
    missingSkill: "尚未取得這個技能。",
    alreadyEquipped: (pet: string, move: string) => `${pet} 已裝備 ${move}。`,
    equippedMove: (pet: string, move: string) => `${pet} 裝備 ${move}。`,
    keepOneMove: "至少要保留 1 個招式。",
    unequippedMove: (pet: string, move: string) => `${pet} 卸下 ${move}。`,
    noSkillTicket: "沒有可用的技能卡券。",
    skillCardsAdded: (count: number) => `${count} 張技能卡已加入背包。`,
    missingWalletCard: "找不到這張錢包卡片，請先同步錢包。",
    cardAlreadyBound: (card: string, move: string) => `${card} 已綁定 ${move}。`,
    missingBackendMove: "後端回傳了不存在的技能，請重新同步。",
    cardBound: (card: string, element: string, move: string) => `${card} 綁定 ${element}屬性技能：${move}。`,
    cardBindFailed: "卡片技能綁定失敗。",
    cardNoSkill: "這張卡還沒有綁定技能，先在錢包卡片點一下抽技能。",
    cardWrongElement: (move: string, element: string) => `${move} 是${element}屬性，只能裝到${element}寵物。`,
    cardEquipped: (pet: string, card: string, move: string) => `${pet} 插入 ${card}，獲得 ${move}。`,
    equipCardFailed: "插卡失敗。",
    cardUnequipped: (pet: string, card: string, move?: string) => `${pet} 卸下 ${card}${move ? ` / ${move}` : ""}。`,
    unequipCardFailed: "卸卡失敗。",
    partyNeedsThree: "請選滿 3 隻寵物上場。",
    aiBattleStarted: (title: string) => `${title}開始。`,
    connectingVersus: "連接真人道館中。",
    roomCreated: "房間已建立，等待對手加入。",
    versusConnectFailed: "真人道館連線失敗。",
    joiningVersus: "加入真人道館中。",
    roomJoined: "已加入房間，等待同步。",
    joinFailed: "加入真人道館失敗。",
    notPlayerTurn: "還沒輪到我方行動。",
    enemyNoAction: "敵方目前無法行動。",
    battleFinished: "戰鬥結束。",
    waitingOpponentAction: "等待對手行動。",
    chooseOneMove: "請至少選擇一隻我方寵物的招式。",
    energyExceeded: (round: number) => `本回合最多 ${round} EN，目前選招超出能量。`,
    versusNotConnected: "真人道館尚未連線。",
    reconnectingNoSubmit: "重新連線中，暫停送出選招。",
    versusNotSynced: "真人道館尚未同步完成。",
    submittedActions: (count: number) => `已送出 ${count} 個行動，等待同步。`,
    noFinishedVersus: "目前沒有已結束的真人戰鬥。",
    versusResyncNoRematch: "真人道館重新同步中，暫時不能再戰。",
    rematchWaitingConfirm: "已準備再戰，等待對手確認。",
    rematchWaitingReconnect: "已準備再戰，等待對手重連。",
    versusDisconnected: "連線中斷，保留真人房並嘗試重連。",
    versusResyncing: "重新同步真人房。",
    versusConnected: "真人道館已連線。",
    versusReconnecting: "重新連線真人道館中。",
    versusReconnectSyncing: "重新連線成功，同步房間中。",
    rpgRoomError: "RPG 房間錯誤。",
    socketNotInitialized: "Socket 尚未初始化。",
    unableConnectRpgServer: "無法連接 RPG 伺服器。",
    socketNotConnected: "RPG socket 尚未連線。",
    unableJoinRpgRoom: "無法加入 RPG 房間。"
  },
  en: {
    waitingOpponent: "Waiting for an opponent.",
    battleFinishedAwaiting: "Battle finished. Waiting for rematch or exit.",
    opponentDisconnected: "Opponent disconnected. Battle is held for reconnect.",
    noElementPet: (element: string) => `No ${element} pet can equip card skills yet.`,
    switchedCardSlot: (pet: string) => `Switched to ${pet}'s card slots.`,
    walletStale: "External wallet API failed for now. Showing the last synced local cards.",
    walletFallback: "Wallet cards are using fallback data.",
    walletReadFailed: "Failed to load wallet cards.",
    partyFull: "Party is full. Remove one slot before adding another pet.",
    wrongPetElement: (move: string, element: string) => `${move} can only be equipped by ${element} pets.`,
    missingSkill: "You do not own this skill yet.",
    alreadyEquipped: (pet: string, move: string) => `${pet} already has ${move}.`,
    equippedMove: (pet: string, move: string) => `${pet} equipped ${move}.`,
    keepOneMove: "Keep at least 1 move.",
    unequippedMove: (pet: string, move: string) => `${pet} removed ${move}.`,
    noSkillTicket: "No skill tickets available.",
    skillCardsAdded: (count: number) => `${count} skill card${count === 1 ? "" : "s"} added to your bag.`,
    missingWalletCard: "Wallet card not found. Sync your wallet first.",
    cardAlreadyBound: (card: string, move: string) => `${card} is already bound to ${move}.`,
    missingBackendMove: "The backend returned a missing skill. Please sync again.",
    cardBound: (card: string, element: string, move: string) => `${card} bound a ${element} skill: ${move}.`,
    cardBindFailed: "Failed to bind card skill.",
    cardNoSkill: "This card has no bound skill yet. Draw a skill from the wallet card first.",
    cardWrongElement: (move: string, element: string) => `${move} is ${element}; it can only be equipped by ${element} pets.`,
    cardEquipped: (pet: string, card: string, move: string) => `${pet} inserted ${card} and gained ${move}.`,
    equipCardFailed: "Failed to insert card.",
    cardUnequipped: (pet: string, card: string, move?: string) => `${pet} removed ${card}${move ? ` / ${move}` : ""}.`,
    unequipCardFailed: "Failed to remove card.",
    partyNeedsThree: "Choose 3 pets for the field.",
    aiBattleStarted: (title: string) => `${title} started.`,
    connectingVersus: "Connecting to player gym.",
    roomCreated: "Room created. Waiting for an opponent.",
    versusConnectFailed: "Player gym connection failed.",
    joiningVersus: "Joining player gym.",
    roomJoined: "Joined room. Waiting for sync.",
    joinFailed: "Failed to join player gym.",
    notPlayerTurn: "It is not your turn yet.",
    enemyNoAction: "Enemy cannot act right now.",
    battleFinished: "Battle finished.",
    waitingOpponentAction: "Waiting for opponent action.",
    chooseOneMove: "Choose at least one allied pet move.",
    energyExceeded: (round: number) => `This turn has at most ${round} EN. Selected moves exceed available energy.`,
    versusNotConnected: "Player gym is not connected.",
    reconnectingNoSubmit: "Reconnecting. Move submission is paused.",
    versusNotSynced: "Player gym has not finished syncing.",
    submittedActions: (count: number) => `Submitted ${count} action${count === 1 ? "" : "s"}. Waiting for sync.`,
    noFinishedVersus: "There is no finished player battle right now.",
    versusResyncNoRematch: "Player gym is resyncing, rematch is paused.",
    rematchWaitingConfirm: "Ready for rematch. Waiting for opponent confirmation.",
    rematchWaitingReconnect: "Ready for rematch. Waiting for opponent reconnect.",
    versusDisconnected: "Connection interrupted. Keeping the player room and trying to reconnect.",
    versusResyncing: "Resyncing player room.",
    versusConnected: "Player gym connected.",
    versusReconnecting: "Reconnecting to player gym.",
    versusReconnectSyncing: "Reconnected. Syncing room.",
    rpgRoomError: "RPG room error.",
    socketNotInitialized: "Socket is not initialized.",
    unableConnectRpgServer: "Unable to connect to RPG server.",
    socketNotConnected: "RPG socket is not connected.",
    unableJoinRpgRoom: "Unable to join RPG room."
  },
  ko: {
    waitingOpponent: "상대를 기다리는 중입니다.",
    battleFinishedAwaiting: "전투가 끝났습니다. 재대전 또는 나가기를 기다립니다.",
    opponentDisconnected: "상대 연결이 끊겼습니다. 재연결을 위해 전투를 유지합니다.",
    noElementPet: (element: string) => `${element} 펫이 아직 없어 카드 스킬을 장착할 수 없습니다.`,
    switchedCardSlot: (pet: string) => `${pet} 카드 슬롯으로 전환했습니다.`,
    walletStale: "외부 지갑 API가 일시적으로 실패했습니다. 마지막 동기화 카드가 표시됩니다.",
    walletFallback: "지갑 카드 소스가 fallback 데이터를 사용 중입니다.",
    walletReadFailed: "지갑 카드를 불러오지 못했습니다.",
    partyFull: "팀이 가득 찼습니다. 먼저 한 칸을 비워 주세요.",
    wrongPetElement: (move: string, element: string) => `${move}는 ${element} 펫만 장착할 수 있습니다.`,
    missingSkill: "아직 이 스킬을 보유하지 않았습니다.",
    alreadyEquipped: (pet: string, move: string) => `${pet}는 이미 ${move}를 장착했습니다.`,
    equippedMove: (pet: string, move: string) => `${pet}가 ${move}를 장착했습니다.`,
    keepOneMove: "최소 1개 기술은 유지해야 합니다.",
    unequippedMove: (pet: string, move: string) => `${pet}가 ${move}를 해제했습니다.`,
    noSkillTicket: "사용 가능한 스킬 티켓이 없습니다.",
    skillCardsAdded: (count: number) => `스킬 카드 ${count}장이 가방에 추가되었습니다.`,
    missingWalletCard: "지갑 카드를 찾을 수 없습니다. 먼저 지갑을 동기화하세요.",
    cardAlreadyBound: (card: string, move: string) => `${card}는 이미 ${move}에 묶여 있습니다.`,
    missingBackendMove: "백엔드가 존재하지 않는 스킬을 반환했습니다. 다시 동기화하세요.",
    cardBound: (card: string, element: string, move: string) => `${card}가 ${element} 스킬에 묶였습니다: ${move}.`,
    cardBindFailed: "카드 스킬 묶기에 실패했습니다.",
    cardNoSkill: "이 카드는 아직 묶인 스킬이 없습니다. 먼저 지갑 카드에서 스킬을 뽑으세요.",
    cardWrongElement: (move: string, element: string) => `${move}는 ${element} 속성이므로 ${element} 펫만 장착할 수 있습니다.`,
    cardEquipped: (pet: string, card: string, move: string) => `${pet}가 ${card}를 삽입해 ${move}를 얻었습니다.`,
    equipCardFailed: "카드 삽입에 실패했습니다.",
    cardUnequipped: (pet: string, card: string, move?: string) => `${pet}가 ${card}${move ? ` / ${move}` : ""}를 해제했습니다.`,
    unequipCardFailed: "카드 해제에 실패했습니다.",
    partyNeedsThree: "출전할 펫 3마리를 선택하세요.",
    aiBattleStarted: (title: string) => `${title} 시작.`,
    connectingVersus: "플레이어 도장에 연결 중입니다.",
    roomCreated: "방을 만들었습니다. 상대를 기다리는 중입니다.",
    versusConnectFailed: "플레이어 도장 연결에 실패했습니다.",
    joiningVersus: "플레이어 도장에 참가 중입니다.",
    roomJoined: "방에 참가했습니다. 동기화를 기다립니다.",
    joinFailed: "플레이어 도장 참가에 실패했습니다.",
    notPlayerTurn: "아직 아군 행동 차례가 아닙니다.",
    enemyNoAction: "적은 지금 행동할 수 없습니다.",
    battleFinished: "전투가 끝났습니다.",
    waitingOpponentAction: "상대 행동을 기다리는 중입니다.",
    chooseOneMove: "아군 펫 기술을 최소 하나 선택하세요.",
    energyExceeded: (round: number) => `이번 턴은 최대 ${round} EN입니다. 선택한 기술이 에너지를 초과했습니다.`,
    versusNotConnected: "플레이어 도장이 아직 연결되지 않았습니다.",
    reconnectingNoSubmit: "재연결 중이라 기술 제출을 잠시 멈춥니다.",
    versusNotSynced: "플레이어 도장 동기화가 아직 끝나지 않았습니다.",
    submittedActions: (count: number) => `행동 ${count}개를 제출했습니다. 동기화를 기다립니다.`,
    noFinishedVersus: "현재 종료된 플레이어 전투가 없습니다.",
    versusResyncNoRematch: "플레이어 도장이 재동기화 중이라 재대전할 수 없습니다.",
    rematchWaitingConfirm: "재대전 준비 완료. 상대 확인을 기다립니다.",
    rematchWaitingReconnect: "재대전 준비 완료. 상대 재연결을 기다립니다.",
    versusDisconnected: "연결이 끊겼습니다. 플레이어 방을 유지하고 재연결을 시도합니다.",
    versusResyncing: "플레이어 방을 다시 동기화합니다.",
    versusConnected: "플레이어 도장이 연결되었습니다.",
    versusReconnecting: "플레이어 도장에 재연결 중입니다.",
    versusReconnectSyncing: "재연결되었습니다. 방을 동기화합니다.",
    rpgRoomError: "RPG 방 오류입니다.",
    socketNotInitialized: "소켓이 초기화되지 않았습니다.",
    unableConnectRpgServer: "RPG 서버에 연결할 수 없습니다.",
    socketNotConnected: "RPG 소켓이 연결되지 않았습니다.",
    unableJoinRpgRoom: "RPG 방에 참가할 수 없습니다."
  }
};

export function rpgNotice(language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_NOTICE_COPY[language];
}

export function rpgCopy(language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language];
}

export function rpgElementLabel(element: RpgElement, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].elements[element].label;
}

export function rpgElementShortLabel(element: RpgElement, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].elements[element].shortLabel;
}

export function rpgPetName(definitionId: string, fallback: string, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].pets[definitionId]?.name ?? fallback;
}

export function rpgPetTitle(definitionId: string, fallback: string, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].pets[definitionId]?.title ?? fallback;
}

export function rpgAiDifficultyCopy(difficulty: RpgAiDifficulty, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].ai[difficulty];
}

export function rpgTicketCopy(ticket: RpgSkillTicket, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].tickets[ticket.id] ?? { label: ticket.label, description: ticket.description, band: ticket.label };
}

export function rpgTierLabel(tier: RpgSkillTier | "all", language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].tiers[tier].label;
}

export function rpgTierShortLabel(tier: RpgSkillTier | "all", language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].tiers[tier].shortLabel;
}

export function rpgTierRangeLabel(tier: RpgSkillTier | "all", language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].tiers[tier].range;
}

export function rpgTargetLabel(target: RpgTarget, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].targets[target];
}

export function rpgBattleTargetLabel(target: RpgTarget, language: RpgLanguage = getCurrentRpgLanguage()) {
  const copy = RPG_TEXT[language].battle;
  if (target === "singleEnemy") return copy.singleEnemy;
  if (target === "singleAlly") return copy.singleAlly;
  if (target === "allEnemies") return copy.allEnemies;
  if (target === "allAllies") return copy.allAllies;
  return copy.self;
}

export function rpgStatusShortLabel(status: RpgStatusId, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].statuses[status].shortLabel;
}

export function rpgStatusLabel(status: RpgStatusId, language: RpgLanguage = getCurrentRpgLanguage()) {
  return RPG_TEXT[language].statuses[status].label;
}

export function rpgGenericStatusLabel(language: RpgLanguage = getCurrentRpgLanguage()) {
  return language === "zh" ? "狀態" : language === "ko" ? "상태" : "Status";
}

export function rpgMoveName(move: RpgMove, language: RpgLanguage = getCurrentRpgLanguage()) {
  if (language === "zh") return move.name;
  const element = rpgElementLabel(move.element, language);
  const style = MOVE_STYLE_COPY[language][move.animation.style];
  const tier = rpgTierLabel(move.tier, language);
  return language === "ko" ? `${element} ${style} ${move.slot}` : `${element} ${style} ${move.slot} (${tier})`;
}

export function rpgMoveDescription(move: RpgMove, language: RpgLanguage = getCurrentRpgLanguage()) {
  if (language === "zh") return move.description;
  const parts: string[] = [];
  if (move.power > 0) {
    parts.push(language === "ko" ? `${rpgBattleTargetLabel(move.target, language)}에게 피해 ${move.power}` : `Deals ${move.power} damage to ${rpgBattleTargetLabel(move.target, language).toLowerCase()}`);
  }
  move.effects.forEach((effect) => {
    if (effect.heal) parts.push(language === "ko" ? `회복 ${effect.heal}` : `heals ${effect.heal}`);
    if (effect.cleanse) parts.push(language === "ko" ? "정화" : "cleanses debuffs");
    if (effect.status) {
      const status = RPG_TEXT[language].statuses[effect.status].label;
      const amount = effect.power ? ` ${effect.power}` : "";
      const duration = effect.duration ? ` / ${effect.duration}T` : "";
      parts.push(language === "ko" ? `${status}${amount}${duration}` : `${status}${amount}${duration}`);
    }
    if (effect.selfDamage) parts.push(language === "ko" ? `자해 ${effect.selfDamage}` : `self-damage ${effect.selfDamage}`);
  });
  if (parts.length === 0) parts.push(language === "ko" ? "전술 효과" : "Tactical effect");
  return language === "ko"
    ? `${parts.join(" · ")}. 비용 ${move.energyCost} EN.`
    : `${parts.join("; ")}. Costs ${move.energyCost} EN.`;
}

export function rpgMoveAnimationName(move: RpgMove, language: RpgLanguage = getCurrentRpgLanguage()) {
  if (language === "zh") return move.animation.name;
  const element = rpgElementLabel(move.element, language);
  const style = MOVE_STYLE_COPY[language][move.animation.style];
  return language === "ko" ? `${element} ${style}` : `${element} ${style}`;
}

export function rpgMoveEffectLabels(move: RpgMove, language: RpgLanguage = getCurrentRpgLanguage()) {
  const copy = RPG_TEXT[language];
  const labels: string[] = [];
  if (move.power > 0) labels.push(language === "zh" ? `傷害 ${move.power}` : language === "ko" ? `피해 ${move.power}` : `Damage ${move.power}`);
  move.effects.forEach((effect) => {
    if (effect.heal) labels.push(language === "zh" ? `${effect.target === "team" ? "全隊回血" : "回血"} ${effect.heal}` : language === "ko" ? `${effect.target === "team" ? "팀 회복" : "회복"} ${effect.heal}` : `${effect.target === "team" ? "Team Heal" : "Heal"} ${effect.heal}`);
    if (effect.cleanse) labels.push(language === "zh" ? "淨化" : language === "ko" ? "정화" : "Cleanse");
    if (effect.status === "guard") labels.push(language === "zh" ? `${effect.target === "team" ? "全隊防護" : "防護"} ${effect.power ?? 0} / ${effect.duration ?? 1}T` : language === "ko" ? `${effect.target === "team" ? "팀 방호" : "방호"} ${effect.power ?? 0} / ${effect.duration ?? 1}T` : `${effect.target === "team" ? "Team Guard" : "Guard"} ${effect.power ?? 0} / ${effect.duration ?? 1}T`);
    if (effect.status === "regen") labels.push(language === "zh" ? `${effect.target === "team" ? "全隊再生" : "再生"} ${effect.power ?? 0} x${effect.duration ?? 1}T` : language === "ko" ? `${effect.target === "team" ? "팀 재생" : "재생"} ${effect.power ?? 0} x${effect.duration ?? 1}T` : `${effect.target === "team" ? "Team Regen" : "Regen"} ${effect.power ?? 0} x${effect.duration ?? 1}T`);
    if (effect.status === "burn" || effect.status === "poison") labels.push(`${copy.statuses[effect.status].shortLabel} ${effect.power ?? 0} x${effect.duration ?? 1}T`);
    if (effect.status === "stun") labels.push(language === "zh" ? `暈眩 ${effect.duration ?? 1}T` : language === "ko" ? `기절 ${effect.duration ?? 1}T` : `Stun ${effect.duration ?? 1}T`);
    if (effect.selfDamage) labels.push(language === "zh" ? `自損 ${effect.selfDamage}` : language === "ko" ? `자해 ${effect.selfDamage}` : `Self ${effect.selfDamage}`);
  });
  return labels.length > 0 ? labels : [language === "zh" ? "純效果" : language === "ko" ? "효과" : "Effect"];
}
