# CODY: CRISPR Oligo Designer for Yeast 🧬

CODY is a web-based bioinformatics tool designed to automate the design of single-stranded oligodeoxynucleotide (ssODN) repair templates and sgRNA cloning oligos for introducing precise point mutations in *Saccharomyces cerevisiae* (Baker's yeast) using CRISPR/Cas9.

##  Features

*   **Automated Target Discovery:** Automatically identifies valid Cas9 target sites (NGG PAMs) within a defined window around your target amino acid residue.
*   **Intelligent Template Design:** Generates repair templates that incorporate your desired point mutation while simultaneously introducing **silent mutations** to destroy the PAM site or seed region. This prevents Cas9 from re-cutting the DNA after successful editing.
*   **Live Genomic Data:** Integrates directly with the Ensembl REST API to fetch the most up-to-date canonical transcript sequences and gene metadata for *S. cerevisiae*.
*   **Ortholog Mapping:** Automatically identifies and displays Human orthologs for the target yeast gene using integrated DIOPT (DRSC Integrative Ortholog Prediction Tool) data.
*   **Visual Alignments:** Provides a clear, color-coded visual alignment comparing the original Genomic DNA (Top) against the generated Repair Template (Bottom), highlighting the point mutation and silent PAM mutations.
*   **Ready-to-Order Oligos:** Generates the exact Forward and Reverse oligos needed to clone the selected sgRNA into standard CRISPR plasmids.

##  How It Works

1.  **Input:** You provide a standard yeast gene symbol (e.g., `PHO13`), the target amino acid residue number (e.g., `112`), and the desired new amino acid in single-letter code (e.g., `A`).
2.  **Sequence Retrieval:** CODY fetches the CDS (Coding DNA Sequence) for the canonical transcript from Ensembl.
3.  **Site Search:** The algorithm scans the DNA sequence surrounding the target codon for valid `NGG` (or `CCN` on the reverse strand) PAM sites.
4.  **Mutation Strategy:** For each valid Cas9 site, CODY attempts to design a repair template:
    *   It first introduces the requested missense mutation.
    *   It then searches for a way to introduce a *silent* mutation (preserving the amino acid sequence) that disrupts the PAM site (NGG → NGH, etc.).
    *   If the PAM cannot be silently mutated, it attempts to silently mutate the "seed region" (the 8-10 bases adjacent to the PAM) to severely reduce Cas9 binding affinity.
5.  **Scoring:** Results are scored and ranked based on the distance from the cut site to the mutation (closer is better for homology-directed repair efficiency) and the robustness of the silent mutation strategy (PAM mutation > Seed mutation).

## 🛠️ Tech Stack

*   **Frontend:** React 18, TypeScript, Vite
*   **Styling:** Tailwind CSS
*   **Icons:** Lucide React
*   **External APIs:** Ensembl REST API
*   **Deployment:** Docker / Google Cloud Run (via AI Studio)

## 📦 Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/cody-yeast-crispr.git
    cd cody-yeast-crispr
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open your browser and navigate to `http://localhost:3000`.

## 📖 Usage Guide

1.  Enter the standard Yeast gene name (e.g., `PHO13`).
2.  Enter the amino acid residue number you wish to mutate (e.g., `112`).
3.  Enter the single-letter code for the **new** amino acid (e.g., `A` for Alanine).
4.  Adjust the oligo length slider to match your synthesis constraints (default is 90bp, which is standard for many ssODN syntheses).
5.  Click **Generate Design**.
6.  Review the ranked list of design options. Each card provides:
    *   The sgRNA sequence.
    *   The full Repair Template sequence.
    *   Cloning oligos for the sgRNA.
    *   A visual alignment of the edit.

##  Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/cody-yeast-crispr/issues). Disclosure: AI was used to design this software and this readme.

## 📝 License

This project is licensed under the MIT License.
