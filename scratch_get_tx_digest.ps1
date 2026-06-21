$body = @{
    jsonrpc = "2.0"
    id = 1
    method = "sui_getTransactionBlock"
    params = @(
        "HU9HBqD3t9Qcv9rgDtBXJbyVi8NqJ8widVAJqJKo5qT8",
        @{
            showEffects = $true
        }
    )
} | ConvertTo-Json -Depth 10

$urls = @(
    "https://sui-testnet-rpc.publicnode.com:443",
    "https://fullnode.testnet.sui.io:443",
    "https://rpc-testnet.suiscan.xyz"
)

foreach ($url in $urls) {
    try {
        $res = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10
        if ($res.result) {
            $res | ConvertTo-Json -Depth 10
            break
        }
    } catch {
        # ignore
    }
}
