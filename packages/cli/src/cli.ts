// packages/cli/src/cli.ts
import { Command, CommanderError } from "commander";
import { CliError, formatOutput, formatErrors, formatThingList, formatStateList, formatLinkList, formatOPDList, formatOPDTree, formatThing, formatState, formatLink, formatOPD } from "./format";
import { executeNew } from "./commands/new";
import { executeAdd } from "./commands/add";
import { executeRemove } from "./commands/remove";
import { executeList } from "./commands/list";
import { executeShow } from "./commands/show";
import { executeValidate } from "./commands/validate";
import { executeUpdate } from "./commands/update";
import { executeRefine } from "./commands/refine";
import { executeOpl } from "./commands/opl";

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
    const result = executeAdd("link", opts as any);
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

program
  .command("validate")
  .description("Validate the model")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeValidate({ file: opts.file as string });

    if (jsonFlag) {
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) throw new CliError("Validation failed", 1);
    } else if (result.valid) {
      const s = result.summary;
      console.log(`Model valid. ${s.things} things, ${s.states} states, ${s.links} links, ${s.opds} OPDs.`);
    } else {
      console.log(formatErrors(result.errors, { json: false }));
      throw new CliError(`Validation failed with ${result.errors.length} errors`, 1);
    }
  });

const update = program
  .command("update")
  .description("Update an entity in the model");

update
  .command("thing")
  .description("Update a thing (object or process)")
  .argument("<id>", "Thing ID")
  .option("--name <name>", "New name")
  .option("--kind <kind>", "object or process")
  .option("--essence <essence>", "physical or informatical")
  .option("--affiliation <affiliation>", "systemic or environmental")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("thing", id, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, id: result.id, entity: result.entity }, null, 2));
    } else {
      const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
      console.log(`Updated ${result.type} ${result.id}${nameStr}`);
    }
  });

update
  .command("state")
  .description("Update a state")
  .argument("<id>", "State ID")
  .option("--name <name>", "New name")
  .option("--parent <parent>", "Parent object ID")
  .option("--initial", "Set as initial state")
  .option("--no-initial", "Unset initial state")
  .option("--final", "Set as final state")
  .option("--no-final", "Unset final state")
  .option("--default", "Set as default state")
  .option("--no-default", "Unset default state")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("state", id, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, id: result.id, entity: result.entity }, null, 2));
    } else {
      const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
      console.log(`Updated ${result.type} ${result.id}${nameStr}`);
    }
  });

update
  .command("link")
  .description("Update a link")
  .argument("<id>", "Link ID")
  .option("--type <type>", "Link type")
  .option("--source <source>", "Source thing ID")
  .option("--target <target>", "Target thing ID")
  .option("--source-state <state>", "Source state ID")
  .option("--target-state <state>", "Target state ID")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("link", id, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, id: result.id, entity: result.entity }, null, 2));
    } else {
      console.log(`Updated ${result.type} ${result.id}`);
    }
  });

update
  .command("opd")
  .description("Update an OPD (Object Process Diagram)")
  .argument("<id>", "OPD ID")
  .option("--name <name>", "New name")
  .option("--opd-type <type>", "hierarchical or view")
  .option("--parent <parent>", "Parent OPD ID")
  .option("--refines <thing>", "Thing ID this OPD refines")
  .option("--refinement <type>", "in-zoom or unfold")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((id: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("opd", id, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, id: result.id, entity: result.entity }, null, 2));
    } else {
      const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
      console.log(`Updated ${result.type} ${result.id}${nameStr}`);
    }
  });

update
  .command("meta")
  .description("Update model metadata")
  .option("--name <name>", "New model name")
  .option("--description <description>", "New description")
  .option("--system-type <type>", "System type")
  .option("--input <input>", "JSON input (agent mode)")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("meta", undefined, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, entity: result.entity }, null, 2));
    } else {
      const nameStr = (result.entity as any)?.name ? ` (${(result.entity as any).name})` : "";
      console.log(`Updated ${result.type}${nameStr}`);
    }
  });

update
  .command("settings")
  .description("Update model settings")
  .option("--input <input>", "JSON input (agent mode, required)")
  .option("--file <file>", "Path to .opmodel file")
  .action((opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeUpdate("settings", undefined, opts as any);
    if (jsonFlag) {
      console.log(JSON.stringify({ action: "updated", type: result.type, entity: result.entity }, null, 2));
    } else {
      console.log(`Updated ${result.type}`);
    }
  });

program
  .command("refine")
  .description("Refine a thing (in-zoom or unfold)")
  .argument("<thingId>", "Thing ID to refine")
  .requiredOption("--opd <opd>", "Parent OPD ID")
  .requiredOption("--type <type>", "Refinement type (in-zoom|unfold)")
  .option("--file <file>", "Path to .opmodel file")
  .action((thingId: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeRefine(thingId, {
      opd: opts.opd as string,
      type: opts.type as any,
      file: opts.file as string,
    });
    if (jsonFlag) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Refined ${thingId} → ${result.opd.name} (${result.opd.refinement_type}, ${result.appearancesCreated} appearances)`);
    }
  });

program
  .command("opl")
  .description("Generate OPL sentences for an OPD")
  .argument("<file>", "Path to .opmodel file")
  .option("--opd <opdId>", "OPD ID (default: root SD)")
  .action((file: string, opts: Record<string, unknown>) => {
    const jsonFlag = program.opts().json as boolean;
    const result = executeOpl({ file, opd: opts.opd as string, json: jsonFlag });
    if (jsonFlag) {
      console.log(JSON.stringify(result.document, null, 2));
    } else {
      console.log(result.text ?? "");
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
