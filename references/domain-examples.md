# Domain Customization Examples

The research-agent can be adapted to ANY research field by editing `config.json`. Here are examples:

## Food Safety (Default)

```json
{
  "domain": {
    "name": "Food Safety Research",
    "description": "AI/ML applications in food safety, quality, and pathogen detection",
    "keywords": {
      "technical": [
        "machine learning", "deep learning", "neural network",
        "computer vision", "convolutional", "artificial intelligence",
        "predictive model", "spectroscopy", "hyperspectral", "sensor"
      ],
      "domain": [
        "food safety", "foodborne", "pathogen", "salmonella",
        "e. coli", "listeria", "dairy", "meat", "spoilage",
        "contamination", "HACCP", "quality assessment"
      ]
    },
    "categories": [
      "Pathogen Detection",
      "Quality Assessment",
      "Supply Chain Safety",
      "Novel Sensors",
      "Predictive Modeling",
      "Other"
    ]
  }
}
```

## Materials Science

```json
{
  "domain": {
    "name": "2D Materials & Nanomaterials",
    "description": "Computational materials science, ML for materials discovery",
    "keywords": {
      "technical": [
        "machine learning", "deep learning", "DFT", "molecular dynamics",
        "density functional theory", "neural network", "GNN",
        "graph neural network", "transfer learning", "active learning"
      ],
      "domain": [
        "2D materials", "graphene", "MoS2", "TMD", "van der Waals",
        "nanomaterials", "band gap", "electronic properties",
        "synthesis", "characterization", "perovskite"
      ]
    },
    "categories": [
      "Materials Discovery",
      "Property Prediction",
      "Synthesis & Fabrication",
      "Characterization",
      "Applications",
      "Other"
    ]
  }
}
```

## Drug Discovery

```json
{
  "domain": {
    "name": "AI-Driven Drug Discovery",
    "description": "Machine learning for drug design, ADMET, and target identification",
    "keywords": {
      "technical": [
        "machine learning", "deep learning", "transformer",
        "GNN", "graph neural network", "AlphaFold", "molecular dynamics",
        "QSAR", "docking", "virtual screening", "generative model"
      ],
      "domain": [
        "drug discovery", "drug design", "ADMET", "binding affinity",
        "molecular", "protein", "ligand", "pharmacokinetics",
        "toxicity", "lead optimization", "target identification",
        "repurposing", "antibody"
      ]
    },
    "categories": [
      "Target Identification",
      "Lead Discovery",
      "Lead Optimization",
      "ADMET Prediction",
      "Drug Repurposing",
      "Other"
    ]
  }
}
```

## Climate Science

```json
{
  "domain": {
    "name": "Climate Modeling & Prediction",
    "description": "AI/ML for climate science, weather forecasting, and environmental monitoring",
    "keywords": {
      "technical": [
        "machine learning", "deep learning", "neural network",
        "LSTM", "transformer", "CNN", "physics-informed",
        "ensemble", "downscaling", "data assimilation"
      ],
      "domain": [
        "climate", "weather", "forecasting", "precipitation",
        "temperature", "extreme events", "sea level", "ocean",
        "atmosphere", "carbon", "emissions", "renewable energy"
      ]
    },
    "categories": [
      "Climate Prediction",
      "Weather Forecasting",
      "Extreme Events",
      "Carbon & Emissions",
      "Renewable Energy",
      "Other"
    ]
  }
}
```

## Astronomy & Astrophysics

```json
{
  "domain": {
    "name": "AI in Astronomy",
    "description": "Machine learning for astronomical data analysis and discovery",
    "keywords": {
      "technical": [
        "machine learning", "deep learning", "neural network",
        "computer vision", "CNN", "classification", "detection",
        "time series", "anomaly detection", "simulation"
      ],
      "domain": [
        "astronomy", "astrophysics", "galaxy", "star",
        "exoplanet", "cosmology", "gravitational", "telescope",
        "survey", "transient", "supernova", "black hole"
      ]
    },
    "categories": [
      "Object Detection & Classification",
      "Exoplanet Discovery",
      "Cosmology",
      "Transient Events",
      "Data Processing",
      "Other"
    ]
  }
}
```

## Neuroscience

```json
{
  "domain": {
    "name": "Computational Neuroscience",
    "description": "AI/ML for brain imaging, neural decoding, and neurological disease",
    "keywords": {
      "technical": [
        "machine learning", "deep learning", "neural network",
        "fMRI", "EEG", "brain-computer interface", "decoding",
        "classification", "segmentation", "convolutional"
      ],
      "domain": [
        "neuroscience", "brain", "neural", "fMRI", "EEG",
        "connectome", "Alzheimer", "Parkinson", "epilepsy",
        "cognitive", "neuroimaging", "BCI", "neural decoding"
      ]
    },
    "categories": [
      "Brain Imaging Analysis",
      "Neural Decoding",
      "Disease Diagnosis",
      "Brain-Computer Interface",
      "Cognitive Models",
      "Other"
    ]
  }
}
```

## Agriculture & Precision Farming

```json
{
  "domain": {
    "name": "AI in Agriculture",
    "description": "Machine learning for crop monitoring, yield prediction, and precision farming",
    "keywords": {
      "technical": [
        "machine learning", "deep learning", "computer vision",
        "remote sensing", "hyperspectral", "UAV", "drone",
        "satellite", "CNN", "object detection", "segmentation"
      ],
      "domain": [
        "agriculture", "crop", "yield", "precision farming",
        "plant disease", "soil", "irrigation", "pest",
        "phenotyping", "greenhouse", "wheat", "corn", "rice"
      ]
    },
    "categories": [
      "Crop Monitoring",
      "Yield Prediction",
      "Disease Detection",
      "Precision Farming",
      "Soil Analysis",
      "Other"
    ]
  }
}
```

## Tips for Customization

### Technical Keywords
Include ML/AI methods relevant to your field:
- General: machine learning, deep learning, neural network, AI
- Vision: computer vision, CNN, object detection, segmentation
- NLP: transformer, BERT, language model, NLP
- Physics: DFT, molecular dynamics, simulation, physics-informed
- Time series: LSTM, RNN, forecasting, anomaly detection

### Domain Keywords
Be specific to your subdomain:
- Use technical jargon (TMD, ADMET, fMRI)
- Include key materials/organisms/phenomena
- Add common acronyms
- Include related applications

### Categories
Choose 4-6 meaningful categories for your field. These help organize the digest and make it scannable.

Good categories are:
- ✅ Non-overlapping
- ✅ Cover main research themes
- ✅ Actionable (users know what to expect)
- ❌ Too broad ("Applications")
- ❌ Too narrow (one paper per category)

## Testing Your Configuration

After editing `config.json`:

1. **Test keyword coverage**:
   - Will your technical keywords catch AI/ML papers?
   - Will your domain keywords exclude irrelevant papers?

2. **Run manually**:
   ```
   Ask Clawdbot: "Run the research-agent skill"
   ```

3. **Check the results**:
   - Getting too many papers? → Increase minRelevanceScore or narrow keywords
   - Getting too few papers? → Broaden keywords or lower minRelevanceScore
   - Wrong categories? → Adjust category names to match your field's language

4. **Iterate**:
   - After a few days, review the digests
   - Tune keywords based on false positives/negatives
   - Adjust categories if papers consistently fall into "Other"
