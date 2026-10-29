export function tableDialog({id, title, label}) {
  const element = document.createElement("div");
  element.className = "table-dialog-control";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = label;
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", id);

  const dialog = document.createElement("dialog");
  dialog.id = id;
  dialog.className = "table-dialog";
  dialog.setAttribute("aria-labelledby", `${id}-title`);
  const header = document.createElement("div");
  header.className = "table-dialog-header";
  const heading = document.createElement("h2");
  heading.id = `${id}-title`;
  heading.textContent = title;
  const form = document.createElement("form");
  form.method = "dialog";
  const close = document.createElement("button");
  close.type = "submit";
  close.textContent = "Close";
  close.autofocus = true;
  form.append(close);
  header.append(heading, form);

  const content = document.createElement("div");
  content.className = "table-dialog-content";
  content.tabIndex = 0;
  content.setAttribute("role", "region");
  content.setAttribute("aria-label", title);
  dialog.append(header, content);
  trigger.addEventListener("click", () => dialog.showModal());
  element.append(trigger, dialog);
  return {element, dialog, content};
}
