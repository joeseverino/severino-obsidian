declare module '*/commands.mjs' {
  export interface ObsidianCommandSpec {
    id: string;
    name: string;
    effect: 'read' | 'local_write' | 'vault_write' | 'remote_write' | 'deploy';
    group: string;
    type: 'callback' | 'editor';
    summary: string;
    delegate?: string;
  }
  export const OBSIDIAN_COMMANDS: ObsidianCommandSpec[];
}
