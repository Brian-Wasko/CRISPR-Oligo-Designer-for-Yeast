import React, { useState } from 'react';
import { InputForm } from './components/InputForm';
import { ResultCard } from './components/ResultCard';
import { resolveGene, fetchOrthologs } from './services/api';
import { findCas9Sites, generateRepairTemplates } from './services/crispr';
import { RepairResult, Ortholog } from './types';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RepairResult[] | null>(null);
  
  const [currentGene, setCurrentGene] = useState<string>("");
  const [currentEntrezId, setCurrentEntrezId] = useState<string | null>(null);
  const [geneDescription, setGeneDescription] = useState<string | null>(null);
  
  const [orthologs, setOrthologs] = useState<Ortholog[]>([]);
  const [isFetchingOrthologs, setIsFetchingOrthologs] = useState(false);

  const [residueForDisplay, setResidueForDisplay] = useState<string>("");
  const [mutationForDisplay, setMutationForDisplay] = useState<string>("");

  const handleGenerate = async (geneInput: string, residue: number, mutation: string, oligoLength: number) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setGeneDescription(null);
    setOrthologs([]);
    setCurrentEntrezId(null);
    
    setCurrentGene(geneInput);
    setResidueForDisplay(residue.toString());
    setMutationForDisplay(mutation);

    try {
      // 1. Fetch Gene Data
      const geneInfo = await resolveGene(geneInput);
      
      setCurrentGene(geneInfo.symbol);
      setCurrentEntrezId(geneInfo.entrezId || null);
      setGeneDescription(geneInfo.description || null);
      
      // 2. Fetch Orthologs (Human)
      setIsFetchingOrthologs(true);

      const orthologsData = await fetchOrthologs(geneInfo.symbol, geneInfo.id, geneInfo.entrezId);
      setOrthologs(orthologsData);
      setIsFetchingOrthologs(false);

      // 4. Find Sites & Generate Templates
      const sites = findCas9Sites(geneInfo.sequence, residue);
      if (sites.length === 0) throw new Error("No nearby Cas9 target sites found within window.");

      const generatedResults = generateRepairTemplates(
        geneInfo.sequence,
        sites,
        residue,
        mutation,
        oligoLength
      );

      if (generatedResults.length === 0) throw new Error("No sgRNAs available where a silent PAM mutation could be successfully created within the selected oligo length.");
      
      const getScoreCategory = (score: number) => score >= 70 ? 3 : (score >= 50 ? 2 : 1);
      const getStrategyPriority = (s: string) => (s.includes('PAM') ? 2 : 1);

      generatedResults.sort((a, b) => {
          const catDiff = getScoreCategory(b.score) - getScoreCategory(a.score);
          if (catDiff !== 0) return catDiff;
          const stratDiff = getStrategyPriority(b.strategy) - getStrategyPriority(a.strategy);
          if (stratDiff !== 0) return stratDiff;
          return b.score - a.score;
      });

      setResults(generatedResults);

    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      setIsFetchingOrthologs(false);
    } finally {
      setLoading(false);
    }
  };

  const renderOrthologs = () => {
      if (isFetchingOrthologs) {
          return (
             <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center gap-3 animate-pulse">
                <div className="h-8 w-8 bg-sky-100 rounded-full"></div>
                <div className="flex-1 space-y-2">
                   <div className="h-3 w-32 bg-slate-200 rounded"></div>
                   <div className="h-2 w-48 bg-slate-100 rounded"></div>
                </div>
             </div>
          );
      }
      
      if (!results && !loading) return null;
      const hasOrthologs = orthologs.length > 0;
      const dioptLink = currentEntrezId 
        ? `https://www.flyrnai.org/cgi-bin/DRSC_orthologs.pl?sc=1&species=4932&input=${currentEntrezId}`
        : `https://www.flyrnai.org/cgi-bin/DRSC_orthologs.pl?sc=1&species=Yeast&input=${currentGene}`;

      return (
          <div className="bg-sky-50 border border-sky-100 rounded-xl p-5 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-sky-100 rounded-lg text-sky-600">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      </div>
                      <div>
                          <h3 className="font-bold text-sky-900 text-sm uppercase tracking-wider">Human Orthologs</h3>
                          <p className="text-xs text-slate-500">Merged from DIOPT & Ensembl</p>
                      </div>
                  </div>
                  <a href={dioptLink} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-600 font-medium hover:underline flex items-center gap-1">
                      View in DIOPT
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                  </a>
              </div>
              
              <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded-lg border-sky-100">
                {hasOrthologs ? (
                  <table className="w-full text-sm text-left bg-white">
                      <thead className="text-xs text-sky-800 uppercase bg-sky-50 sticky top-0 shadow-sm z-10">
                          <tr>
                              <th className="px-3 py-2">Symbol</th>
                              <th className="px-3 py-2">DIOPT Score</th>
                          </tr>
                      </thead>
                      <tbody>
                          {orthologs.map((orth, idx) => (
                              <tr key={idx} className="border-b border-sky-50 last:border-0 hover:bg-sky-50 transition-colors">
                                  <td className="px-3 py-2 font-bold text-slate-700">
                                      {orth.symbol}
                                      {orth.bestScore && <span className="ml-2 text-[10px] bg-sky-200 text-sky-800 px-1.5 py-0.5 rounded-full" title="Best Score">Best</span>}
                                  </td>
                                  <td className="px-3 py-2">
                                      <div className="flex items-center gap-2">
                                         <div className="h-1.5 w-12 bg-slate-200 rounded-full overflow-hidden">
                                             <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, (orth.score / 15) * 100)}%` }}></div>
                                         </div>
                                         <span className="text-xs text-slate-700 font-medium">{orth.score > 0 ? orth.score : '-'}</span>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  ) : (
                      <div className="text-center py-4 text-sm text-slate-500 italic">
                          No orthologs found directly.
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-20">
      <header className="bg-indigo-700 text-white py-8 shadow-lg">
        <div className="container mx-auto px-4 max-w-5xl">
          <h1 className="text-3xl font-bold tracking-tight mb-2">CODY - CRISPR Oligo Designer for Yeast</h1>
          <p className="text-indigo-200">Automated repair template and cloning oligo design for point mutations in <span className="italic">S. cerevisiae</span>.</p>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-5xl -mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <InputForm isLoading={loading} onSubmit={handleGenerate} />
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
               <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">Instructions</h3>
               <ul className="text-sm text-slate-600 space-y-2 list-disc pl-4">
                 <li>Enter the standard Yeast gene name (e.g., PHO13).</li>
                 <li>Enter the amino acid residue number to mutate.</li>
                 <li>Enter the single-letter code for the <strong>new</strong> amino acid.</li>
                 <li>Adjust the oligo length slider to match your synthesis constraints.</li>
                 <li className="pt-2 mt-2 border-t border-slate-100">
                    <span className="font-semibold block mb-1">Color Key:</span>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-red-600 font-bold bg-slate-100 px-1 rounded">Red Text</span>
                        <span className="text-xs">= Point Mutation</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-purple-600 font-bold bg-slate-100 px-1 rounded">Purple Text</span>
                        <span className="text-xs">= PAM Site</span>
                    </div>
                 </li>
               </ul>
            </div>
          </div>

          <div className="lg:col-span-2">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 shadow-sm">
                <strong>Error:</strong> {error}
              </div>
            )}

            {loading && !results && (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 text-slate-400">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p>Analyzing gene sequence and calculating alignments...</p>
                </div>
            )}

            {!loading && !results && !error && (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400">
                 <p className="text-lg font-medium">Ready to design</p>
                 <p className="text-sm">Enter parameters to begin.</p>
              </div>
            )}

            {results && (
              <div className="animate-fade-in">
                 <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 mb-4">
                    <div className="flex items-start gap-4">
                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-indigo-900 mb-1">Gene: {currentGene}</h3>
                            <p className="text-indigo-800 text-sm leading-relaxed">
                                {geneDescription || "No description available."}
                            </p>
                        </div>
                    </div>
                 </div>

                 {renderOrthologs()}

                <div className="flex items-center justify-between mb-6">
                   <h2 className="text-2xl font-bold text-slate-800">Design Results</h2>
                   <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-bold">
                     {results.length} Options Found
                   </span>
                </div>

                <div className="flex flex-col gap-10">
                  {results.map((result, idx) => (
                    <React.Fragment key={idx}>
                      <ResultCard result={result} index={idx} />
                      {idx < results.length - 1 && (
                        <hr className="border-t-4 border-slate-800 rounded-full" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
