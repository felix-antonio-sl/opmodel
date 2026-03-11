// packages/cli/src/cli.ts
import { Command, CommanderError } from "commander";
import { CliError, formatOutput } from "./format";
import { executeNew } from "./commands/new";
import { executeAdd } from "./commands/add";
import { executeRemove } from "./commands/remove";

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

const add = program
  .command("add")
  .description("Add an entity to the model");

add
  .command("thing")
  .description("Add a thing (object or process)")
  .argument("[name]", "Thing name")
  .option("--kind <kind>", "object or process")
  .option("--essence <essence>", "physical or informatical")
  .option("--affiliation <affiliation>", "systemic or environmental", "systemic")
  .option("--id <id>", "Custom ID")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((name: string | undefined, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeAdd("thing", { name, ...opts } as any);
    console.log(formatOutput(
      { action: "added", ...result },
      { json: jsonFlag },
    ));
  });

add
  .command("state")
  .description("Add a state to an object")
  .argument("[name]", "State name")
  .option("--parent <parent>", "Parent object ID (required)")
  .option("--initial", "Mark as initial state", false)
  .option("--final", "Mark as final state", false)
  .option("--default", "Mark as default state", false)
  .option("--id <id>", "Custom ID")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((name: string | undefined, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeAdd("state", { name, ...opts } as any);
    console.log(formatOutput(
      { action: "added", ...result },
      { json: jsonFlag },
    ));
  });

add
  .command("link")
  .description("Add a link between things")
  .option("--type <type>", "Link type (effect|agent|consumption|...)")
  .option("--source <source>", "Source thing ID")
  .option("--target <target>", "Target thing ID")
  .option("--source-state <state>", "Source state ID")
  .option("--target-state <state>", "Target state ID")
  .option("--id <id>", "Custom ID")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeAdd("link", {
      ...opts,
      sourceState: opts.sourceState as string,
      targetState: opts.targetState as string,
    } as any);
    console.log(formatOutput(
      { action: "added", ...result },
      { json: jsonFlag },
    ));
  });

add
  .command("opd")
  .description("Add an OPD (Object Process Diagram)")
  .argument("[name]", "OPD name")
  .option("--parent <parent>", "Parent OPD ID")
  .option("--opd-type <type>", "hierarchical or view")
  .option("--refines <thing>", "Thing ID this OPD refines")
  .option("--refinement <type>", "in-zoom or unfold")
  .option("--id <id>", "Custom ID")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((name: string | undefined, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeAdd("opd", { name, ...opts } as any);
    console.log(formatOutput(
      { action: "added", ...result },
      { json: jsonFlag },
    ));
  });

const remove = program
  .command("remove")
  .description("Remove an entity from the model");

for (const entityType of ["thing", "state", "link", "opd"]) {
  remove
    .command(entityType)
    .description(`Remove a ${entityType}`)
    .argument("<id>", `${entityType} ID`)
    .option("--dry-run", "Show what would be removed without removing", false)
    .option("--file <file>", "Path to .opmodel file")
    .action((id: string, opts: Record<string, unknown>) => {
      const jsonFlag = program.opts().json as boolean;
      const result = executeRemove(entityType, id, {
        file: opts.file as string,
        dryRun: opts.dryRun as boolean,
      });
      if (jsonFlag) {
        console.log(formatOutput(
          { action: result.dryRun ? "dry-run" : "removed", ...result },
          { json: true },
        ));
      } else {
        const cascadeEntries = Object.entries(result.cascade).filter(([, v]) => v > 0);
        const cascadeStr = cascadeEntries.length > 0
          ? ` (cascade: ${cascadeEntries.map(([k, v]) => `${v} ${k}`).join(", ")})`
          : "";
        const prefix = result.dryRun ? "Would remove" : "Removed";
        console.log(`${prefix} ${entityType} ${id}${cascadeStr}`);
      }
    });
}

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
