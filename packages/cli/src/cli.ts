// packages/cli/src/cli.ts
import { Command, CommanderError } from "commander";
import { CliError, formatOutput, formatThingList, formatStateList, formatLinkList, formatOPDList, formatOPDTree } from "./format";
import { executeNew } from "./commands/new";
import { executeAdd } from "./commands/add";
import { executeRemove } from "./commands/remove";
import { executeList } from "./commands/list";
import { executeShow } from "./commands/show";
import { formatThing, formatState, formatLink, formatOPD } from "./format";

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

const list = program
  .command("list")
  .description("List entities in the model");

list
  .command("things")
  .description("List all things")
  .option("--kind <kind>", "Filter by kind (object|process)")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeList("things", opts as any);
    console.log(formatThingList(result.entities as any[], { json: jsonFlag }));
  });

list
  .command("states")
  .description("List all states")
  .option("--parent <parent>", "Filter by parent thing ID")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeList("states", opts as any);
    console.log(formatStateList(result.entities as any[], { json: jsonFlag }));
  });

list
  .command("links")
  .description("List all links")
  .option("--type <type>", "Filter by link type")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeList("links", opts as any);
    console.log(formatLinkList(result.entities as any[], { json: jsonFlag }));
  });

list
  .command("opds")
  .description("List all OPDs")
  .option("--tree", "Show as tree hierarchy", false)
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeList("opds", opts as any);
    const formatter = opts.tree ? formatOPDTree : formatOPDList;
    console.log(formatter(result.entities as any[], { json: jsonFlag }));
  });

program
  .command("show")
  .description("Show details of an entity")
  .argument("<id>", "Entity ID")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeShow(id, { file: opts.file as string });

    if (jsonFlag) {
      console.log(JSON.stringify(result.entity, null, 2));
      return;
    }

    const formatters: Record<string, (entity: any, opts: { json: boolean }) => string> = {
      thing: formatThing,
      state: formatState,
      link: formatLink,
      opd: formatOPD,
    };
    const formatter = formatters[result.entityType];
    if (formatter) {
      let output = formatter(result.entity as any, { json: false });
      if (result.related?.states && (result.related.states as any[]).length > 0) {
        output += `\n  states:     ${(result.related.states as any[]).map((s: any) => s.id).join(", ")}`;
      }
      if (result.related?.appearances && (result.related.appearances as any[]).length > 0) {
        output += `\n  appearances: ${(result.related.appearances as any[]).length} in this OPD`;
      }
      console.log(output);
    } else {
      // P1+ fallback
      console.log(`${result.entityType}: ${id}`);
      console.log(JSON.stringify(result.entity, null, 2));
    }
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
