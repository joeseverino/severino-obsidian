import { App, Modal } from 'obsidian';

export interface ResultSection {
  heading: string;
  lines: string[];
  tone?: 'ok' | 'warn' | 'error' | 'muted';
}

// A small, reusable modal for surfacing CLI/MCP results (publish gate, tag
// report, graphics status) in the editor.
export class ResultModal extends Modal {
  constructor(
    app: App,
    private readonly title: string,
    private readonly sections: ResultSection[],
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('svo-result');
    contentEl.createEl('h3', { text: this.title });
    for (const section of this.sections) {
      contentEl.createEl('h4', { text: section.heading, cls: section.tone ? `svo-${section.tone}` : '' });
      const ul = contentEl.createEl('ul');
      if (!section.lines.length) {
        ul.createEl('li', { text: '—', cls: 'svo-muted' });
        continue;
      }
      for (const line of section.lines) {
        ul.createEl('li', { text: line, cls: section.tone ? `svo-${section.tone}` : '' });
      }
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
