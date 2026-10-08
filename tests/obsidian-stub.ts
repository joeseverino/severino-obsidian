// Runtime stand-in for the `obsidian` package, which only exists inside the app.
// Provides the classes the plugin's pure logic checks with `instanceof`.

export class TAbstractFile {
  path = '';
  name = '';
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  extension = '';
  basename = '';
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export class MarkdownView {}
