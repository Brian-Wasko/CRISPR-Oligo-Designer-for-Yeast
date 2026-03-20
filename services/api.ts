import { GeneInfo, Ortholog } from '../types';
import { dioptData } from '../DIOPT2026';

const ENSEMBL_BASE = "https://rest.ensembl.org";

export async function resolveGene(geneSymbol: string): Promise<GeneInfo> {
  const xrefResponse = await fetch(
    `${ENSEMBL_BASE}/xrefs/symbol/saccharomyces_cerevisiae/${geneSymbol}?content-type=application/json`
  );
  if (!xrefResponse.ok) throw new Error("Gene symbol lookup failed");
  const xrefData = await xrefResponse.json();
  if (!xrefData.length) throw new Error(`Gene '${geneSymbol}' not found in Yeast database.`);

  const id = xrefData[0].id;
  const canonicalSymbol = xrefData[0].display_id || geneSymbol;

  const seqResponse = await fetch(
    `${ENSEMBL_BASE}/sequence/id/${id}?type=cds;content-type=text/plain`
  );
  if (!seqResponse.ok) throw new Error("Sequence lookup failed");
  const sequence = await seqResponse.text();

  let description = "No description available.";
  let transcriptId = id;
  let entrezId: string | undefined;

  try {
      const [lookupResponse, entrezResponse] = await Promise.all([
          fetch(`${ENSEMBL_BASE}/lookup/id/${id}?expand=1&content-type=application/json`),
          fetch(`${ENSEMBL_BASE}/xrefs/id/${id}?external_db=EntrezGene;content-type=application/json`)
      ]);

      if (lookupResponse.ok) {
          const lookupData = await lookupResponse.json();
          if (lookupData.description) description = lookupData.description;
          if (lookupData.Transcript && lookupData.Transcript.length > 0) {
              transcriptId = lookupData.Transcript[0].id;
          }
      }

      if (entrezResponse.ok) {
          const entrezData = await entrezResponse.json();
          if (entrezData && entrezData.length > 0) {
              entrezId = entrezData[0].primary_id;
          }
      }

  } catch (e) {
      console.warn("Failed to fetch gene details or Entrez ID", e);
  }

  return { id, transcriptId, entrezId, symbol: canonicalSymbol, sequence: sequence.trim(), description };
}

// 2. Map Yeast Residue to Human Residue using Alignment
export function mapResidueToOrtholog(
    yeastResidueIndex: number, // 1-based
    alignment: { sourceSeq: string, targetSeq: string }
): { humanResidueIndex: number, humanAA: string } | null {
    const { sourceSeq, targetSeq } = alignment;
    
    // Iterate through source (Yeast) sequence to find the column corresponding to the residue
    // Note: alignment sequences contain gaps '-'.
    let currentYeastIndex = 0;
    let alignmentColumn = -1;

    for (let i = 0; i < sourceSeq.length; i++) {
        if (sourceSeq[i] !== '-') {
            currentYeastIndex++;
        }
        if (currentYeastIndex === yeastResidueIndex) {
            alignmentColumn = i;
            break;
        }
    }

    if (alignmentColumn === -1) return null;

    // Check target (Human) sequence at that column
    const humanAA = targetSeq[alignmentColumn];
    if (humanAA === '-' || humanAA === undefined) return null; // Gap in human, cannot map

    // Count human residues up to that column to get index
    let currentHumanIndex = 0;
    for (let i = 0; i <= alignmentColumn; i++) {
        if (targetSeq[i] !== '-') {
            currentHumanIndex++;
        }
    }

    return {
        humanResidueIndex: currentHumanIndex,
        humanAA: humanAA
    };
}

// Check similarity groupings
export function isResidueSimilar(aa1: string, aa2: string): boolean {
    if (aa1 === aa2) return true;
    const groups = [
        ['G', 'A', 'V', 'L', 'I'], // Aliphatic
        ['F', 'Y', 'W'], // Aromatic
        ['K', 'R', 'H'], // Positively charged
        ['D', 'E'], // Negatively charged
        ['S', 'T'], // Polar uncharged
        ['C', 'M'], // Sulfur
        ['N', 'Q']  // Amide
    ];
    return groups.some(group => group.includes(aa1) && group.includes(aa2));
}

export async function fetchOrthologs(geneSymbol: string, ensemblId: string, entrezId?: string): Promise<Ortholog[]> {
    const candidates: Map<string, Ortholog> = new Map();
    // Key by uppercase SYMBOL for easy merging

    const addOrUpdate = (o: Ortholog, key: string) => {
        if (!candidates.has(key)) {
            candidates.set(key, o);
        } else {
            const existing = candidates.get(key)!;
            candidates.set(key, {
                ...existing,
                // If we are merging Ensembl data into a DIOPT entry:
                ensemblId: o.ensemblId || existing.ensemblId, 
                alignment: o.alignment || existing.alignment,
                // Keep the better score/bestScore from DIOPT usually
                score: Math.max(existing.score, o.score),
                bestScore: existing.bestScore || o.bestScore,
                source: 'Merged'
            });
        }
    };

    // 1. DIOPT (for Scores)
    const matches = dioptData.filter(d => 
        (entrezId && String(d.yeastGeneId) === String(entrezId)) || 
        (geneSymbol && d.yeastSymbol.toUpperCase() === geneSymbol.toUpperCase())
    );

    matches.forEach(o => {
        const symbol = o.humanSymbol;
        if (!symbol) return;
        
        addOrUpdate({
            symbol: symbol,
            geneId: String(o.humanGeneId),
            score: o.dioptScore || 0,
            bestScore: o.bestScore === "Yes",
            source: 'DIOPT'
        }, symbol.toUpperCase());
    });

    // 2. Ensembl Homology (for Identity, IDs and Alignment)
    try {
        const r = await fetch(`${ENSEMBL_BASE}/homology/id/${ensemblId}?target_species=homo_sapiens;type=orthologues;content-type=application/json;sequence=1`);
        if (r.ok) {
            const data = await r.json();
            if (data?.data?.[0]?.homologies) {
                data.data[0].homologies.forEach((h: any) => {
                    const targetId = h.target.id;
                    const symbol = h.target.display_id || targetId;
                    
                    const ortholog: Ortholog = {
                        symbol: symbol,
                        geneId: targetId,
                        ensemblId: targetId,
                        score: 0,
                        bestScore: false,
                        source: 'Ensembl',
                        alignment: {
                            sourceSeq: h.source.align_seq,
                            targetSeq: h.target.align_seq
                        }
                    };
                    addOrUpdate(ortholog, symbol.toUpperCase());
                });
            }
        }
    } catch (e) {
        console.warn("Ensembl Homology fetch failed", e);
    }

    const finalResults = Array.from(candidates.values());
    
    return finalResults.sort((a, b) => {
        if (a.bestScore !== b.bestScore) return a.bestScore ? -1 : 1;
        return b.score - a.score;
    }).slice(0, 15);
}
