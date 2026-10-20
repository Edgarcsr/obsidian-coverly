import { Modal, Notice } from "obsidian";
import type { App } from "obsidian";

import { t } from "./i18n";
import { isPerfEnabled, perfSnapshot, resetPerf } from "./perf";
import type { PerfSnapshot } from "./perf";

const notify = (message: string): Notice => new Notice(message);

const DECIMALS = 1;
const TASK_ROWS = 10;

/** "12,3 ms": duração curta, no formato de número do sistema. */
const ms = (value: number): string =>
  `${value.toLocaleString(undefined, { maximumFractionDigits: DECIMALS })} ms`;

/** Relatório de desempenho: tempos por ponto quente, tarefas longas, caches e contadores. */
export class PerfModal extends Modal {
  constructor(app: App) {
    super(app);
    this.setTitle(t("perf.title"));
    this.modalEl.addClass("mdp-perf-modal");
  }

  onOpen(): void {
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    const snapshot = perfSnapshot();
    if (!isPerfEnabled()) {
      contentEl.createEl("p", {
        cls: "mdp-perf-empty",
        text: t("perf.disabled"),
      });
    }

    const actions = contentEl.createDiv({ cls: "mdp-perf-actions" });
    actions
      .createEl("button", { text: t("perf.refresh") })
      .addEventListener("click", () => {
        this.render();
      });
    actions
      .createEl("button", { text: t("perf.reset") })
      .addEventListener("click", () => {
        resetPerf();
        this.render();
      });
    actions
      .createEl("button", { text: t("perf.copy") })
      .addEventListener("click", () => {
        void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
        notify(t("perf.copied"));
      });

    this.renderMetrics(contentEl, snapshot);
    this.renderLongTasks(contentEl, snapshot);
    this.renderPairs(
      contentEl,
      t("perf.counters"),
      Object.entries(snapshot.counters)
    );
    this.renderPairs(
      contentEl,
      t("perf.caches"),
      Object.entries(snapshot.gauges)
    );
  }

  // oxlint-disable-next-line class-methods-use-this
  private renderMetrics(root: HTMLElement, snapshot: PerfSnapshot): void {
    root.createEl("h4", { text: t("perf.timings") });
    if (snapshot.metrics.length === 0) {
      root.createEl("p", { cls: "mdp-perf-empty", text: t("perf.empty") });
      return;
    }
    const table = root.createEl("table", { cls: "mdp-perf-table" });
    const head = table.createEl("thead").createEl("tr");
    for (const key of [
      "perf.col.name",
      "perf.col.count",
      "perf.col.mean",
      "perf.col.p95",
      "perf.col.max",
      "perf.col.total",
    ] as const) {
      head.createEl("th", { text: t(key) });
    }
    const body = table.createEl("tbody");
    for (const metric of snapshot.metrics) {
      const row = body.createEl("tr");
      row.createEl("td", { text: metric.name });
      row.createEl("td", { text: String(metric.count) });
      row.createEl("td", { text: ms(metric.mean) });
      row.createEl("td", { text: ms(metric.p95) });
      row.createEl("td", { text: ms(metric.max) });
      row.createEl("td", { text: ms(metric.total) });
    }
  }

  // oxlint-disable-next-line class-methods-use-this
  private renderLongTasks(root: HTMLElement, snapshot: PerfSnapshot): void {
    root.createEl("h4", { text: t("perf.longTasks") });
    if (snapshot.longTasks.length === 0) {
      root.createEl("p", {
        cls: "mdp-perf-empty",
        text: t("perf.noLongTasks"),
      });
      return;
    }
    const list = root.createEl("ul");
    for (const task of snapshot.longTasks.slice(-TASK_ROWS).toReversed()) {
      list.createEl("li", {
        text: t("perf.longTask", {
          at: Math.round(task.at / 1000),
          duration: ms(task.duration),
        }),
      });
    }
  }

  // oxlint-disable-next-line class-methods-use-this
  private renderPairs(
    root: HTMLElement,
    title: string,
    pairs: [string, number | string][]
  ): void {
    if (pairs.length === 0) {
      return;
    }
    root.createEl("h4", { text: title });
    const table = root.createEl("table", { cls: "mdp-perf-table" });
    const body = table.createEl("tbody");
    for (const [name, value] of pairs) {
      const row = body.createEl("tr");
      row.createEl("td", { text: name });
      row.createEl("td", { text: String(value) });
    }
  }
}
