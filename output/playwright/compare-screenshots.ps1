param([string]$BeforeFolder='before', [string]$ReportName='screenshot-comparison.json', [switch]$ExcludeDevBadge)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class ScreenshotPixels {
  public static long[] Compare(string first, string second, int badgeViewportHeight) {
    using (var a = new Bitmap(first)) using (var b = new Bitmap(second)) {
      if(a.Size != b.Size) return new long[] {a.Width,a.Height,b.Width,b.Height,-1,0,0,0,0};
      var rect = new Rectangle(0,0,a.Width,a.Height);
      var da=a.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
      var db=b.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);
      try {
        var ba=new byte[da.Stride*a.Height]; var bb=new byte[db.Stride*b.Height];
        Marshal.Copy(da.Scan0,ba,0,ba.Length); Marshal.Copy(db.Scan0,bb,0,bb.Length);
        long count=0; int left=a.Width,top=a.Height,right=0,bottom=0;
        for(int y=0;y<a.Height;y++) for(int x=0;x<a.Width;x++) {
          if(badgeViewportHeight > 0 && x < 80 && y >= badgeViewportHeight-70 && y <= badgeViewportHeight+20) continue;
          int i=y*da.Stride+x*4; int j=y*db.Stride+x*4;
          if(ba[i]!=bb[j] || ba[i+1]!=bb[j+1] || ba[i+2]!=bb[j+2] || ba[i+3]!=bb[j+3]) {
            count++; left=Math.Min(left,x);top=Math.Min(top,y);right=Math.Max(right,x);bottom=Math.Max(bottom,y);
          }
        }
        return new long[] {a.Width,a.Height,b.Width,b.Height,count,left,top,right,bottom};
      } finally {a.UnlockBits(da);b.UnlockBits(db);}
    }
  }
}
'@
$results=Get-ChildItem -LiteralPath "$PSScriptRoot/$BeforeFolder" -Filter *.png | ForEach-Object {
  $after=Join-Path "$PSScriptRoot/after" $_.Name
  if(Test-Path -LiteralPath $after) {
    $badgeHeight=0
    if($ExcludeDevBadge -and $_.Name -match '-\d+x(\d+)\.png$') { $badgeHeight=[int]$Matches[1] }
    $comparison=[ScreenshotPixels]::Compare($_.FullName,$after,$badgeHeight)
    [pscustomobject]@{file=$_.Name;beforeSize="$($comparison[0])x$($comparison[1])";afterSize="$($comparison[2])x$($comparison[3])";differentPixels=$comparison[4];differencePercent=[math]::Round(100*$comparison[4]/($comparison[0]*$comparison[1]),4);bounds=$comparison[5..8]}
  }
}
$results | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath "$PSScriptRoot/$ReportName" -Encoding utf8
$results | Select-Object file,differentPixels,differencePercent | Format-Table -AutoSize
