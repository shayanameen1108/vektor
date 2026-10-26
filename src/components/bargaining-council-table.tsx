import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const LINKS = {
  about: {
    bccei: "about-council-bccei",
    nbcei: "about-council-nbcei",
    meibc: "about-council-meibc",
  },
  help: {
    bccei: "help-bccei-link",
    nbcei: "help-nbcei-link",
    meibc: "help-meibc-link",
  },
} as const;

export function BargainingCouncilTable({ variant }: { variant: keyof typeof LINKS }) {
  const ids = LINKS[variant];

  return (
    <Table className="mt-8 border border-border bg-card text-sm [&_th]:whitespace-normal [&_td]:whitespace-normal">
      <TableHeader className="table-caps bg-muted text-muted-foreground">
        <TableRow className="hover:bg-transparent">
          <TableHead className="border-b border-border px-3 py-2 text-left">CIDB Class</TableHead>
          <TableHead className="border-b border-border px-3 py-2 text-left">
            Applicable Council
          </TableHead>
          <TableHead className="border-b border-border px-3 py-2 text-left">Scope</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-border">
        <TableRow className="hover:bg-transparent">
          <TableCell className="px-3 py-2 font-mono">CE</TableCell>
          <TableCell className="px-3 py-2">
            <a
              href="https://www.bccei.co.za"
              target="_blank"
              rel="noreferrer"
              data-testid={ids.bccei}
              className="text-primary underline"
            >
              BCCEI — Civil Engineering
            </a>
          </TableCell>
          <TableCell className="px-3 py-2 text-muted-foreground">National</TableCell>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableCell className="px-3 py-2 font-mono">EB / EP</TableCell>
          <TableCell className="px-3 py-2">
            <a
              href="https://www.nbcei.co.za"
              target="_blank"
              rel="noreferrer"
              data-testid={ids.nbcei}
              className="text-primary underline"
            >
              NBCEI — Electrical
            </a>
          </TableCell>
          <TableCell className="px-3 py-2 text-muted-foreground">National</TableCell>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableCell className="px-3 py-2 font-mono">ME</TableCell>
          <TableCell className="px-3 py-2">
            <a
              href="https://www.meibc.co.za"
              target="_blank"
              rel="noreferrer"
              data-testid={ids.meibc}
              className="text-primary underline"
            >
              MEIBC — Mechanical / HVAC
            </a>
            <p className="mt-0.5 text-xs text-muted-foreground">
              HVAC also needs SARACCA + SAQCC Gas registration
            </p>
          </TableCell>
          <TableCell className="px-3 py-2 text-muted-foreground">National</TableCell>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableCell className="px-3 py-2 font-mono" rowSpan={5}>
            GB
          </TableCell>
          <TableCell className="px-3 py-2">
            <a
              href="https://www.bibc.co.za"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              BIBC (Cape of Good Hope)
            </a>
          </TableCell>
          <TableCell className="px-3 py-2 text-muted-foreground">Western Cape</TableCell>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableCell className="px-3 py-2">
            <a
              href="https://www.bibcpe.co.za"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              BIBC (Southern &amp; Eastern Cape)
            </a>
          </TableCell>
          <TableCell className="px-3 py-2 text-muted-foreground">
            Southern &amp; Eastern Cape
          </TableCell>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableCell className="px-3 py-2">BIBC (East London)</TableCell>
          <TableCell className="px-3 py-2 text-muted-foreground">East London / Border</TableCell>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableCell className="px-3 py-2">BIBC (Kimberley)</TableCell>
          <TableCell className="px-3 py-2 text-muted-foreground">
            Kimberley / Northern Cape
          </TableCell>
        </TableRow>
        <TableRow className="hover:bg-transparent">
          <TableCell className="px-3 py-2">BCBI (Bloemfontein)</TableCell>
          <TableCell className="px-3 py-2 text-muted-foreground">
            Bloemfontein / Free State
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
