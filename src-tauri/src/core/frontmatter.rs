use serde_json::{Map, Value};

#[derive(Debug)]
pub struct ParsedFrontmatter {
    pub frontmatter: Map<String, Value>,
    pub body: String,
}

pub fn parse_frontmatter(content: &str) -> Result<ParsedFrontmatter, String> {
    let normalized = content.replace("\r\n", "\n");
    if !normalized.starts_with("---\n") {
        return Ok(ParsedFrontmatter {
            frontmatter: Map::new(),
            body: content.to_string(),
        });
    }

    let remainder = &normalized[4..];
    let Some(split_index) = remainder.find("\n---\n") else {
        return Err("Invalid frontmatter: missing closing delimiter".to_string());
    };

    let yaml = &remainder[..split_index];
    let body = &remainder[split_index + 5..];
    let yaml_value: serde_yaml::Value =
        serde_yaml::from_str(yaml).map_err(|err| format!("Invalid frontmatter: {err}"))?;
    let json_value = serde_json::to_value(yaml_value)
        .map_err(|err| format!("Frontmatter conversion failed: {err}"))?;

    let frontmatter = match json_value {
        Value::Object(map) => map,
        _ => Map::new(),
    };

    Ok(ParsedFrontmatter {
        frontmatter,
        body: body.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::parse_frontmatter;

    #[test]
    fn parses_yaml_frontmatter_and_body() {
        let parsed = parse_frontmatter(
            "---\nname: test\ndescription: demo\nkeywords:\n  - one\n  - two\n---\n# Body\n",
        )
        .expect("frontmatter should parse");

        assert_eq!(
            parsed
                .frontmatter
                .get("name")
                .and_then(|value| value.as_str()),
            Some("test")
        );
        assert_eq!(parsed.body.trim(), "# Body");
    }

    #[test]
    fn returns_empty_frontmatter_when_missing() {
        let parsed = parse_frontmatter("# No frontmatter").expect("parse should succeed");
        assert!(parsed.frontmatter.is_empty());
        assert_eq!(parsed.body, "# No frontmatter");
    }

    #[test]
    fn rejects_unclosed_frontmatter_block() {
        let err = parse_frontmatter("---\nname: broken\n").expect_err("parse should fail");
        assert!(err.contains("missing closing delimiter"));
    }
}
