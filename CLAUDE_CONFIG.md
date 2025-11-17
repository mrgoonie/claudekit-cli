# Claude Code Configuration

The global user-specific `.claude` directory on Windows, primarily used for Claude Code and the Claude desktop app configuration, is typically located at: 
`%USERPROFILE%/.claude` or `~/.claude`

You can access this directory by opening File Explorer and navigating to the following path (replace [USERNAME] with your actual username): 
`C:\Users\[USERNAME]\.claude`

## Key Locations and Files
The `.claude` directory and related global files store user settings, commands, and memory that apply across all projects.

| Location | Purpose |
| --- | --- |
| `~/.claude/settings.json` | User-specific settings that apply to all projects. |
| `~/.claude/commands/` | Directory for storing custom global commands. |
| `~/.claude/CLAUDE.md` | Personal preferences and instructions that the AI considers globally. |
| `~/.claude.json` | Main global configuration file (highest priority). |

For the general Claude Desktop application (not specifically the Claude Code CLI component), the main configuration and logs are located in a slightly different directory:
`%APPDATA%\Claude`
- Full path: `C:\Users\[USERNAME]\AppData\Roaming\Claude`
- Inside this folder, you might find files like `claude_desktop_config.json`.

### Note on Windows Subsystem for Linux (WSL):
If you are using Claude Code within the Windows Subsystem for Linux (WSL), the `~/.claude` path refers to the home directory within the Linux environment (e.g., `/home/[linux_username]/.claude`), not the Windows file system directly.