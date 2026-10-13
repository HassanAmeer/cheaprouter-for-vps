export function registerProvider(program) {
  program
    .command("provider [subcommand]")
    .description("Manage provider connections (use 'providers' for the full interface)")
    .allowUnknownOption()
    .allowExcessArguments()
    .action(() => {
      console.log(`
  Use \`cheaproute providers\` for the full provider management interface:

    cheaproute providers available   — show provider catalog
    cheaproute providers list        — list configured connections
    cheaproute providers test <name> — test a provider connection
    cheaproute providers test-all    — test all active connections
    cheaproute providers validate    — validate local configuration
    cheaproute providers add <id>    — add an API-key connection
    cheaproute providers auth <id>   — start an existing OAuth flow
    cheaproute providers remove <id> — remove a connection (requires confirmation)
`);
    });
}
