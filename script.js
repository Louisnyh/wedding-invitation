const sampleData = {
  wedding: {
    couple: "Louis & Joyce",
    date: "5 December 2026",
    guestCount: "200 pax",
  },
  guestTypes: {
    family: {
      label: "给家人",
      title: "{name}，谢谢你一路把我们放在心上。",
      message:
        "这一天对我们很重要，因为你会在场。我们想在玻璃花房的灯光里，好好向你说一声谢谢，也请你见证我们成为彼此的家人。",
    },
    colleagues: {
      label: "给同事",
      title: "{name}，很开心能把生活里重要的一面，也分享给你。",
      message:
        "平日里我们一起处理工作，这一次想邀请你来到更柔软的场景。愿这个晚上没有日程压力，只有祝福、晚风和一顿认真准备的晚餐。",
    },
    closeFriends: {
      label: "给挚友",
      title: "{name}，有些朋友，不需要太多解释就懂。",
      message:
        "我们想让你坐在离这一刻很近的地方。谢谢你见过我们的普通日子，也愿意来见证我们最郑重的一天。",
    },
    longLostFriends: {
      label: "给久别重逢的朋友",
      title: "{name}，这一晚也想把你带回我们身边。",
      message:
        "婚礼是这一晚的主角，但我们也悄悄期待那些久违的拥抱和一句“好久不见”。你的位置已经留好，希望十二月能在花房灯光下重新见到你。",
    },
  },
  details: [
    {
      label: "日期",
      value: "2026年12月5日",
      note: "星期六，晚间婚礼",
    },
    {
      label: "时间",
      value: "18:00 入场 · 18:45 仪式",
      note: "花园灯光会在傍晚慢慢亮起",
    },
    {
      label: "地点",
      value: "玻璃花房花园，吉隆坡",
      note: "户外花园与透明玻璃结构",
    },
    {
      label: "着装",
      value: "浅色正式着装",
      note: "象牙白、柔薰衣草、尤加利绿或香槟金细节皆可",
    },
  ],
  dining: [
    {
      label: "Pre-set Starter",
      title: "预设前菜",
      note: "入座时已准备好第一道轻食，让大家不用一开始就离席取餐。",
    },
    {
      label: "Served Main Course",
      title: "桌边主菜",
      note: "主菜会送到每一位宾客面前，把晚餐时间留给交谈、举杯和祝福。",
    },
    {
      label: "Dessert Table",
      title: "甜点台",
      note: "仪式与晚宴之后，大家可以自由取用甜点，慢慢走动，也慢慢重逢。",
    },
  ],
  tables: [
    {
      id: "chaos-committee",
      name: "The Chaos Committee",
      story:
        "这一桌为久未见面的朋友而设。你们不一定每天联系，但只要坐下来，很快就会想起以前为什么聊得那么开心。",
      theme: "温柔重逢、慢慢举杯、把旧话题聊成新的回忆。",
    },
    {
      id: "family-garden",
      name: "Family Garden Table",
      story:
        "这一桌留给一路陪伴两人成长的家人。很多承诺，其实早在日常照顾里就已经开始。",
      theme: "家人的见证、安静的骄傲、长久的祝福。",
    },
    {
      id: "glasshouse-colleagues",
      name: "Glasshouse Colleagues",
      story:
        "这一桌属于工作里相互支持的人。今晚暂时放下会议和讯息，只留下举杯和祝福。",
      theme: "从工作伙伴，到生活重要时刻的见证者。",
    },
    {
      id: "lavender-circle",
      name: "Lavender Circle",
      story:
        "这一桌安排给最懂新人细节的挚友。你们见过他们的犹豫、认真，也见证这份关系慢慢稳定下来。",
      theme: "亲近、柔软、把祝福说得很具体。",
    },
  ],
  guests: [
    {
      token: "jason-a7k29x",
      name: "Jason",
      type: "longLostFriends",
      tableId: "chaos-committee",
      status: "confirmed",
    },
    {
      token: "marcus-f4p81q",
      name: "Marcus",
      type: "longLostFriends",
      tableId: "chaos-committee",
      status: "confirmed",
    },
    {
      token: "weijie-n6v42m",
      name: "Wei Jie",
      type: "longLostFriends",
      tableId: "chaos-committee",
      status: "confirmed",
    },
    {
      token: "kelvin-h8s13b",
      name: "Kelvin",
      type: "longLostFriends",
      tableId: "chaos-committee",
      status: "confirmed",
    },
    {
      token: "amanda-k5r18n",
      name: "Amanda",
      type: "closeFriends",
      tableId: "chaos-committee",
      status: "confirmed",
    },
    {
      token: "rachel-p2d77u",
      name: "Rachel",
      type: "closeFriends",
      tableId: "chaos-committee",
      status: "pending",
    },
    {
      token: "daniel-z9q20c",
      name: "Daniel",
      type: "colleagues",
      tableId: "chaos-committee",
      status: "declined",
    },
    {
      token: "auntmay-l9p31e",
      name: "Aunt May",
      type: "family",
      tableId: "family-garden",
      status: "confirmed",
    },
    {
      token: "uncleben-r3x55t",
      name: "Uncle Ben",
      type: "family",
      tableId: "family-garden",
      status: "confirmed",
    },
    {
      token: "meilin-y4c62a",
      name: "Mei Lin",
      type: "family",
      tableId: "family-garden",
      status: "pending",
    },
    {
      token: "sarah-c8m40q",
      name: "Sarah",
      type: "colleagues",
      tableId: "glasshouse-colleagues",
      status: "confirmed",
    },
    {
      token: "aaron-v7t90s",
      name: "Aaron",
      type: "colleagues",
      tableId: "glasshouse-colleagues",
      status: "confirmed",
    },
    {
      token: "nadia-b1k72p",
      name: "Nadia",
      type: "colleagues",
      tableId: "glasshouse-colleagues",
      status: "declined",
    },
    {
      token: "chloe-w6n15d",
      name: "Chloe",
      type: "closeFriends",
      tableId: "lavender-circle",
      status: "confirmed",
    },
    {
      token: "ethan-m2h48j",
      name: "Ethan",
      type: "closeFriends",
      tableId: "lavender-circle",
      status: "confirmed",
    },
  ],
  memoryPrompts: [
    "你仍然记得的一段回忆是什么？",
    "如果年轻时的我们今天重新见面，会觉得最不可思议的是什么？",
    "你想对即将步入婚姻的 Louis & Joyce 说什么？",
  ],
};

const token = new URLSearchParams(window.location.search).get("token");
const currentGuest = sampleData.guests.find((guest) => guest.token === token);
const currentTable = currentGuest
  ? sampleData.tables.find((table) => table.id === currentGuest.tableId)
  : null;

const guestCategoryLabel = document.querySelector("#guest-category-label");
const personalTitle = document.querySelector("#personal-title");
const personalMessage = document.querySelector("#personal-message");
const detailsGrid = document.querySelector("#details-grid");
const diningSteps = document.querySelector("#dining-steps");
const tableTitle = document.querySelector("#table-title");
const tableStory = document.querySelector("#table-story");
const tableTheme = document.querySelector("#table-theme");
const memberList = document.querySelector("#member-list");
const promptList = document.querySelector("#prompt-list");
const memoryForm = document.querySelector("#memory-form");
const memoryInput = document.querySelector("#memory-input");
const memoryConfirmation = document.querySelector("#memory-confirmation");
const rsvpTitle = document.querySelector("#rsvp-title");
const rsvpOptions = document.querySelectorAll(".rsvp-option");
const rsvpFollowup = document.querySelector("#rsvp-followup");
const revealItems = document.querySelectorAll(".scene-reveal");

let selectedPrompt = sampleData.memoryPrompts[0];

function formatGuestText(text, guest) {
  return text.replaceAll("{name}", guest.name);
}

function renderInvalidInvitation() {
  document.querySelector("main").innerHTML = `
    <section class="scene invitation-scene" aria-labelledby="invalid-title">
      <div class="scene-inner">
        <div class="personal-panel scene-reveal is-visible">
          <p class="kicker">邀请链接无效</p>
          <h2 id="invalid-title">我们暂时无法找到这份专属邀请。</h2>
          <p>
            这个链接可能缺少邀请码，或邀请码并不在宾客名单中。
            请回到原本收到的邀请讯息重新打开，或联系 Louis & Joyce 确认你的专属链接。
          </p>
          <p class="personal-signature">Louis & Joyce</p>
        </div>
      </div>
    </section>
  `;
}

function renderPersonalInvitation() {
  const guestType = sampleData.guestTypes[currentGuest.type];

  guestCategoryLabel.textContent = guestType.label;
  personalTitle.textContent = formatGuestText(guestType.title, currentGuest);
  personalMessage.textContent = formatGuestText(guestType.message, currentGuest);
}

function renderDetails() {
  detailsGrid.innerHTML = "";

  sampleData.details.forEach((item) => {
    const detail = document.createElement("article");
    detail.className = "detail-item";
    detail.innerHTML = `
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <p>${item.note}</p>
    `;
    detailsGrid.appendChild(detail);
  });
}

function renderDining() {
  diningSteps.innerHTML = "";

  sampleData.dining.forEach((item) => {
    const step = document.createElement("article");
    step.className = "dining-step";
    step.innerHTML = `
      <span>${item.label}</span>
      <strong>${item.title}</strong>
      <p>${item.note}</p>
    `;
    diningSteps.appendChild(step);
  });
}

function renderTable() {
  tableTitle.textContent = currentTable.name;
  tableStory.textContent = currentTable.story;
  tableTheme.textContent = currentTable.theme;
}

function renderMembers() {
  memberList.innerHTML = "";

  sampleData.guests
    .filter(
      (guest) =>
        guest.tableId === currentGuest.tableId && guest.status === "confirmed"
    )
    .forEach((guest) => {
      const item = document.createElement("li");
      item.innerHTML = `
        <strong>${guest.name}</strong>
        <span>已确认出席</span>
      `;
      memberList.appendChild(item);
    });
}

function renderMemoryPrompts() {
  promptList.innerHTML = "";

  sampleData.memoryPrompts.forEach((prompt, index) => {
    const button = document.createElement("button");
    button.className = "prompt-button";
    button.type = "button";
    button.textContent = prompt;

    if (index === 0) {
      button.classList.add("is-selected");
    }

    button.addEventListener("click", () => {
      selectedPrompt = prompt;
      promptList
        .querySelectorAll(".prompt-button")
        .forEach((option) => option.classList.remove("is-selected"));
      button.classList.add("is-selected");
      memoryInput.placeholder = prompt;
    });

    promptList.appendChild(button);
  });
}

function renderRsvpFollowup(status) {
  if (status === "attending") {
    rsvpFollowup.innerHTML = `
      <form class="attending-form" id="attending-form">
        <div class="field">
          <label for="guest-count">出席人数</label>
          <input id="guest-count" name="guest-count" type="number" min="1" max="4" value="1" />
        </div>
        <div class="field">
          <label for="dietary">饮食需求</label>
          <input id="dietary" name="dietary" type="text" placeholder="例如：素食、清真、无特别需求" />
        </div>
        <div class="field">
          <label for="allergies">过敏事项</label>
          <input id="allergies" name="allergies" type="text" placeholder="例如：坚果、海鲜、无" />
        </div>
        <div class="field">
          <label for="special-notes">特别备注</label>
          <input id="special-notes" name="special-notes" type="text" placeholder="任何我们需要提前知道的事" />
        </div>
        <button class="rsvp-save" type="submit">保存出席回复</button>
      </form>
    `;

    const attendingForm = document.querySelector("#attending-form");

    if (!attendingForm) {
      return;
    }

    attendingForm.addEventListener("submit", (event) => {
      event.preventDefault();
      rsvpFollowup.innerHTML = `
        <p class="rsvp-message">
          谢谢你，${currentGuest.name}。我们已经为你记录出席回复，也会根据你的备注安排晚宴细节。
        </p>
      `;
    });
    return;
  }

  if (status === "unsure") {
    rsvpFollowup.innerHTML = `
      <p class="rsvp-message">
        我们会先为你保留座位。<br />
        仍然希望十二月能和你一起庆祝。
      </p>
    `;
    return;
  }

  rsvpFollowup.innerHTML = `
    <p class="rsvp-message">
      我们会想念你在场的样子。<br />
      等婚礼之后，我们再找一个时间好好见面。
    </p>
  `;
}

function setupRsvp() {
  rsvpTitle.textContent = `${currentGuest.name}，你会来到花房，和我们一起庆祝吗？`;

  rsvpOptions.forEach((button) => {
    button.addEventListener("click", () => {
      rsvpOptions.forEach((option) => option.classList.remove("is-selected"));
      button.classList.add("is-selected");
      renderRsvpFollowup(button.dataset.rsvp);
    });
  });
}

function setupMemoryForm() {
  memoryInput.placeholder = selectedPrompt;

  memoryForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const memory = memoryInput.value.trim();

    if (!memory) {
      memoryInput.focus();
      return;
    }

    memoryConfirmation.textContent = `已保存：${selectedPrompt} — ${memory}`;
    memoryInput.value = "";
  });
}

function setupReveal() {
  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function renderInvitation() {
  if (!currentGuest || !currentTable) {
    renderInvalidInvitation();
    return;
  }

  renderPersonalInvitation();
  renderDetails();
  renderDining();
  renderTable();
  renderMembers();
  renderMemoryPrompts();
  setupMemoryForm();
  setupRsvp();
  setupReveal();
}

renderInvitation();
