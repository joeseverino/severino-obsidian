import { ItemView, WorkspaceLeaf, debounce } from 'obsidian';
import { buildPreviewDoc } from './render';
import { getActiveWriteup, localAssetResolver } from './writeup';

export const PREVIEW_VIEW_TYPE = 'severino-site-preview';

// A side pane that renders the active writeup exactly as the site will, in a
// sandboxed iframe (full style isolation — the site CSS can't leak into
// Obsidian's UI, and Obsidian's can't bleed into the preview).
export class SitePreviewView extends ItemView {
  private frame: HTMLIFrameElement | null = null;
  private placeholder: HTMLElement | null = null;
  private lastHtml: string | null = null;

  // Chromium leaves an iframe's scroll layer stuck after the element resizes;
  // only a document reload rebuilds it. Reload once the drag settles, but keep
  // the iframe hidden until scroll is restored so there's no visible jump.
  private readonly relayoutOnResize = debounce(
    () => {
      const frame = this.frame;
      if (!frame || frame.style.display === 'none' || !frame.getAttribute('srcdoc')) return;
      const y = frame.contentWindow?.scrollY ?? 0;
      frame.style.visibility = 'hidden';
      frame.onload = () => {
        frame.contentWindow?.scrollTo(0, y);
        frame.style.visibility = '';
      };
      frame.srcdoc = frame.srcdoc; // reassign → reload → fresh scroll layer
    },
    120,
    true,
  );

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return PREVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Site preview';
  }

  getIcon(): string {
    return 'eye';
  }

  onResize(): void {
    this.relayoutOnResize();
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('svo-preview');
    this.placeholder = this.contentEl.createDiv({
      cls: 'svo-preview-placeholder',
      text: 'Open a writeup (05 Writeups/<slug>/index.md) to preview it as the site renders it.',
    });
    this.frame = this.contentEl.createEl('iframe', { cls: 'svo-preview-frame' });
    // No allow-scripts: the preview is inert HTML. allow-same-origin lets us
    // read/restore scroll position across refreshes.
    this.frame.setAttribute('sandbox', 'allow-same-origin allow-popups');
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.frame) return;
    const writeup = await getActiveWriteup(this.app);

    if (!writeup) {
      this.frame.style.display = 'none';
      if (this.placeholder) this.placeholder.style.display = '';
      this.lastHtml = null;
      return;
    }

    if (this.placeholder) this.placeholder.style.display = 'none';
    this.frame.style.display = '';

    const fm = writeup.frontmatter as {
      title?: string;
      published_at?: string;
      cover_image?: string;
      cover_alt?: string;
      technologies?: string[];
    };
    const html = buildPreviewDoc({
      markdown: writeup.markdown,
      slug: writeup.slug,
      title: fm.title ?? writeup.slug,
      date: fm.published_at,
      coverImage: fm.cover_image,
      coverAlt: fm.cover_alt,
      technologies: Array.isArray(fm.technologies) ? fm.technologies : [],
      resolveAsset: localAssetResolver(this.app, writeup.file),
    });

    // Nothing changed (e.g. just focusing the pane) — don't reload, or the
    // iframe snaps to the top and you can never scroll.
    if (html === this.lastHtml) return;

    // Content did change: reload, then restore scroll so live edits don't yank
    // you back to the top.
    const scrollY = this.frame.contentWindow?.scrollY ?? 0;
    this.frame.onload = () => {
      if (scrollY) this.frame?.contentWindow?.scrollTo(0, scrollY);
    };
    this.frame.srcdoc = html;
    this.lastHtml = html;
  }
}
