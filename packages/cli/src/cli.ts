// packages/cli/src/cli.ts
import { Command } from "commander";

const program = new Command();

program
  .name("opmod")
  .description("OPM Modeling CLI")
  .version("0.1.0")
  .option("--json", "Output in JSON format", false)
  .exitOverride(); // throw instead of process.exit — enables CliError catch

program.parse();
