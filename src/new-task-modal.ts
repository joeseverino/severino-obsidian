import { App, Modal, Setting, Notice } from 'obsidian';

export interface ProjectOption {
  slug: string;
  open: number;
}

export interface NewTaskInput {
  title: string;
  project: string | null; // null = cross-cutting (07 Backlog)
  effort: string;
  priority: string;
}

const CROSS = '__cross__';

// The task-creation form — one native Obsidian modal (Title / Project / Effort /
// Priority). It owns nothing but the UI: the project universe is the MCP's
// `task-projects`, and on submit it hands the values back to the caller, which
// calls `severino-vault-mcp task-add`. The plugin never writes the file, never
// decides where it goes, never validates — the brain does all of that.
export class NewTaskModal extends Modal {
  private title = '';
  private project: string | null;
  private effort = 'S';
  private priority = 'med';
  private submitted = false;

  constructor(
    app: App,
    private readonly projects: ProjectOption[],
    defaultProject: string | null,
    private readonly onSubmit: (input: NewTaskInput) => void | Promise<void>,
  ) {
    super(app);
    this.project = defaultProject;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('svo-new-task');
    contentEl.createEl('h3', { text: 'New task' });

    // Full-width title input (Obsidian styles bare inputs natively), Enter submits.
    const titleEl = contentEl.createEl('input', { type: 'text', cls: 'svo-new-task-title' });
    titleEl.placeholder = 'Imperative, e.g. "Fix the bats PATH trap"';
    titleEl.addEventListener('input', () => (this.title = titleEl.value));
    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.submit();
      }
    });

    new Setting(contentEl)
      .setName('Project')
      .setDesc('Where it lives — its tasks/ folder, or the cross-cutting bucket.')
      .addDropdown((d) => {
        for (const p of this.projects) {
          d.addOption(p.slug, p.open ? `${p.slug} · ${p.open} open` : p.slug);
        }
        d.addOption(CROSS, 'Cross-cutting (07 Backlog)');
        d.setValue(this.project ?? CROSS);
        d.onChange((v) => (this.project = v === CROSS ? null : v));
      });

    new Setting(contentEl).setName('Effort').addDropdown((d) => {
      d.addOption('S', 'S').addOption('M', 'M').addOption('L', 'L').setValue(this.effort);
      d.onChange((v) => (this.effort = v));
    });

    new Setting(contentEl).setName('Priority').addDropdown((d) => {
      d.addOption('high', 'high').addOption('med', 'med').addOption('low', 'low').setValue(this.priority);
      d.onChange((v) => (this.priority = v));
    });

    new Setting(contentEl)
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton((b) => b.setButtonText('Create task').setCta().onClick(() => void this.submit()));

    window.setTimeout(() => titleEl.focus(), 0);
  }

  private async submit(): Promise<void> {
    if (this.submitted) return;
    const title = this.title.trim();
    if (!title) {
      new Notice('Give the task a title.');
      return;
    }
    this.submitted = true;
    this.close();
    await this.onSubmit({ title, project: this.project, effort: this.effort, priority: this.priority });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
