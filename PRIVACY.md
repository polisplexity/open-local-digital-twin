# Privacy

Open Local Digital Twin is designed so a city can start from public and
non-personal data. The public baseline does not require personal microdata.

## Default Data Posture

The default baseline uses public or open urban data such as:

- city boundaries;
- roads and mobility networks;
- building footprints;
- public facilities;
- green-blue infrastructure;
- places and settlement anchors;
- public environmental and terrain signals;
- source metadata, provenance, and quality records.

## Personal Data

The public runtime should not expose personal microdata. If a deployment adds
private, sensitive, or personal data, that deployment must configure its own
privacy controls, access rules, retention policy, and legal basis before use.

The open runtime provides data-model boundaries for:

- source evidence;
- consolidated inventory;
- provider layers;
- city-authoritative layers;
- aggregate social, economic, and cultural observations;
- privacy posture metadata.

## Aggregation

Society and culture reports are intended to be aggregate and source-quality
explicit. The runtime should avoid claims about individuals, households, or
protected groups unless the deployment has lawful, reviewed, and appropriate
data governance.

## Public And Private Modes

Deployments should separate:

- public open-data views;
- authenticated analyst views;
- provider upload workflows;
- city-authoritative review workflows;
- private operational layers.

## Operator Responsibilities

Organizations deploying Open Local Digital Twin are responsible for:

- complying with applicable privacy and data-protection laws;
- reviewing source licenses and terms;
- configuring access controls;
- preventing publication of sensitive datasets;
- documenting authority decisions and data provenance;
- reviewing any AI-assisted outputs before operational use.
