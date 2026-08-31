 #long  
# always@(.....negedge rst_n) // not 低电位 == 检测高电位
```verilog
if (!rst_n)begin
	< = 32'd0 // 初始化为 0 ，一直初始化也就相当于一直没启动 
			  // 所以posedge的检测不会干扰到取值，导致开始前就有值
end else begin
	< = xxx // 什么有效的值变化
end
```
