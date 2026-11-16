SHELL := /bin/bash
CSV   := inventory/nodes.csv

.PHONY: help generate check lint clean

help:
	@echo "make generate  - regenerate hosts block, netplan files, prometheus targets"
	@echo "make check     - validate inventory + generated files are up to date"
	@echo "make lint      - shellcheck / yamllint / nft -c where the tools exist"

generate:
	./dns/hosts.generate.sh > dns/hosts.block
	./dns/hosts.generate.sh -p > dns/hosts.dnsmasq
	./netplan/gen-netplan.sh
	./monitoring/gen-prometheus-targets.sh > monitoring/network-scrape.yml

check:
	./scripts/inventory-validate.sh
	@# regenerate netplan in place; any diff against the index means a hand edit or a stale file
	./netplan/gen-netplan.sh
	git diff --exit-code -- netplan/*.yaml

lint:
	@if command -v shellcheck >/dev/null; then shellcheck -x -S warning scripts/*.sh firewall/*.sh ssh/*.sh dns/*.sh netplan/*.sh monitoring/*.sh qos/*.sh; else echo "shellcheck not installed - skipped"; fi
	@if command -v yamllint  >/dev/null; then yamllint -d relaxed netplan ansible monitoring; else echo "yamllint not installed - skipped"; fi
	@for f in firewall/compute.nft firewall/anchor.nft; do \
	  if command -v nft >/dev/null; then nft -c -f $$f; else echo "nft not installed - skipped $$f"; fi; done
	@if command -v promtool >/dev/null; then promtool check rules monitoring/network-alerts.rules.yml; else echo "promtool not installed - skipped"; fi

clean:
	rm -f dns/hosts.block dns/hosts.dnsmasq monitoring/network-scrape.yml
