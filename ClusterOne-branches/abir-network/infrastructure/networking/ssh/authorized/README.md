# Authorized public keys

One file per person: `<username>.pub` (public key only — `.gitignore` blocks private keys).
Add a key by PR; `audit-authorized-keys.sh` compares what is deployed on each node against this directory.

- Keys must be ed25519 (`ssh-keygen -t ed25519 -C "<name>@clusterone"`).
- Leaving the team = delete the file, merge, then run the Ansible `ssh` play. Removal is the whole offboarding step for cluster access.
- The orchestration key (anchor → nodes, used by Slurm/Ansible) is separate; rotate it with `../rotate-orchestration-key.sh`.
