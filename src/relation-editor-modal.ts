import { App, Modal, Setting, Notice, TFile } from 'obsidian';

export interface RelationSchema {
  statuses: string[];
  task_statuses: string[];
  sensitivities: string[];
}

export interface RelationCurrent {
  doc_type: string;
  related_projects: string[];
  status: string;
  sensitivity: string;
}

export interface RelationChanges {
  related_projects: string[];
  status: string | null;
  sensitivity: string | null;
}

// Edit a doc's relations + enum fields from the live registry/schema, so they
// can't dangle or be mistyped. The plugin owns only the form; the project
// universe is the MCP's `task-projects`, the enums are `schema`, and the write
// goes back through `update-frontmatter` (the one writer). doc_type is shown
// read-only — changing it is structural, not a relation edit.
export class RelationEditorModal extends Modal {
  private selected: Set<string>;
  private status: string;
  private sensitivity: string;
  private chipsEl: HTMLElement | null = null;

  constructor(
    app: App,
    private readonly file: TFile,
    private readonly current: RelationCurrent,
    private readonly projects: string[],
    private readonly schema: RelationSchema,
    private readonly onSave: (changes: RelationChanges) => void | Promise<void>,
  ) {
    super(app);
    this.selected = new Set(current.related_projects);
    this.status = current.status;
    this.sensitivity = current.sensitivity;
  }

  private isTask(): boolean {
    return this.current.doc_type === 'task';
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('svo-relations');
    contentEl.createEl('h3', { text: `Relations — ${this.file.basename}` });

    // related_projects: removable chips + an add dropdown (registry-backed).
    new Setting(contentEl).setName('Related projects').setDesc('From the live project registry — pick, never type.');
    this.chipsEl = contentEl.createDiv({ cls: 'svo-relations-chips' });
    this.renderChips();

    const remaining = () => this.projects.filter((p) => !this.selected.has(p));
    new Setting(contentEl).setName('Add project').addDropdown((d) => {
      d.addOption('', '— add —');
      for (const p of remaining()) d.addOption(p, p);
      d.onChange((v) => {
        if (!v) return;
        this.selected.add(v);
        this.renderChips();
        // Rebuild this dropdown's options so the added one drops out.
        d.selectEl.empty();
        d.addOption('', '— add —');
        for (const p of remaining()) d.addOption(p, p);
        d.setValue('');
      });
    });

    // status: the right enum for the doc class.
    const statuses = this.isTask() ? this.schema.task_statuses : this.schema.statuses;
    new Setting(contentEl).setName('Status').addDropdown((d) => {
      for (const s of statuses) d.addOption(s, s);
      if (statuses.includes(this.status)) d.setValue(this.status);
      d.onChange((v) => (this.status = v));
    });

    // sensitivity: standard docs only (tasks have none).
    if (!this.isTask()) {
      new Setting(contentEl).setName('Sensitivity').addDropdown((d) => {
        for (const s of this.schema.sensitivities) d.addOption(s, s);
        if (this.schema.sensitivities.includes(this.sensitivity)) d.setValue(this.sensitivity);
        d.onChange((v) => (this.sensitivity = v));
      });
    }

    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton((b) => b.setButtonText('Save').setCta().onClick(() => void this.save()));
  }

  private renderChips(): void {
    const el = this.chipsEl;
    if (!el) return;
    el.empty();
    if (!this.selected.size) {
      el.createSpan({ cls: 'svo-relations-empty', text: 'none' });
      return;
    }
    for (const project of [...this.selected].sort()) {
      const chip = el.createSpan({ cls: 'svo-relations-chip' });
      chip.createSpan({ text: project });
      const x = chip.createSpan({ cls: 'svo-relations-x', text: '×' });
      x.onclick = () => {
        this.selected.delete(project);
        this.renderChips();
      };
    }
  }

  private async save(): Promise<void> {
    const projects = [...this.selected].sort();
    const changes: RelationChanges = {
      related_projects: projects,
      status: this.status !== this.current.status ? this.status : null,
      sensitivity: !this.isTask() && this.sensitivity !== this.current.sensitivity ? this.sensitivity : null,
    };
    this.close();
    await this.onSave(changes);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
