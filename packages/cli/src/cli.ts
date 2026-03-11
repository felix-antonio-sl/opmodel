// packages/cli/src/cli.ts
import { Command, CommanderError } from "commander";
import { CliError, formatOutput } from "./format";
import { executeNew } from "./commands/new";

const program = new Command();

program
  .name("opmod")
  .description("OPM Modeling CLI")
  .version("0.1.0")
  .option("--json", "Output in JSON format", false)
  .exitOverride(); // throw CommanderError instead of process.exit

program
  .command("new")
  .description("Create a new OPM model")
  .argument("<name>", "Model name")
  .option("--type <type>", "System type (artificial|natural|social|socio-technical)")
  .option("--force", "Overwrite existing file", false)
  .action((name: string, opts: Record<string, unknown>) => {
    const json = program.opts().json as boolean;
    const result = executeNew(name, { type: opts.type as any, force: opts.force as boolean });
    console.log(formatOutput(
      { action: "created", type: "model", id: result.name, path: result.filePath },
      { json },
    ));
  });

// Global error handler
try {
  program.parse();
} catch (e) {
  if (e instanceof CliError) {
    process.stderr.write(e.message + "\n");
    process.exit(e.exitCode);
  }
  if (e instanceof CommanderError) {
    // Commander help/version output — exit cleanly
    if (e.exitCode === 0) process.exit(0);
    process.stderr.write(e.message + "\n");
    process.exit(2);
  }
  throw e;
}
